import {
    CacheService,
    DateUtil,
    getByPath,
    InjectCache,
    InjectS3Object,
    mapDocToDto,
    pickIds,
    S3ObjectService
} from '@mannercode/common'
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { AppConfigService } from 'shared'
import { AssetsRepository } from './assets.repository'
import { AssetPresignedUploadDto, CreateAssetDto, FinalizeAssetDto, AssetDto } from './dtos'
import { AssetErrors } from './errors'
import { Asset } from './models'

const CLEANUP_LOCK_KEY = 'cleanup-expired-uploads'
// 최악 경우 cleanup 이 lock 자동 만료 전에 끝낼 수 있을 만큼은 길고, runner 가 죽었을 때
// 다음 cron interval 한 회차 이상으로 작업이 굶주리지 않을 만큼은 짧게.
const CLEANUP_LOCK_TTL_MS = 5 * 60 * 1000

// Cron 데코레이터는 모듈 로드 시점에 평가되므로 DI 로 못 가져온다.
// 운영에서 튜닝할 값이 아니라 코드 상수로 둔다.
const EXPIRED_UPLOAD_CLEANUP_CRON = CronExpression.EVERY_10_MINUTES

@Injectable()
export class AssetsService {
    private readonly logger = new Logger(AssetsService.name)

    constructor(
        private readonly repository: AssetsRepository,
        @InjectS3Object() private readonly s3Service: S3ObjectService,
        @InjectCache('assets') private readonly cache: CacheService,
        private readonly config: AppConfigService
    ) {}

    @Cron(EXPIRED_UPLOAD_CLEANUP_CRON, { name: 'assets.cleanupExpiredUploads' })
    async cleanupExpiredUploads() {
        // 모든 replica 가 이 cron 을 돌리니까, 실제 작업은 distributed lock 으로 가둬야 한다.
        // withLock 은 Redis SET NX + token 매칭 DEL 을 써서, 한 interval 에 정확히 하나의
        // replica 만 cleanup 을 수행하도록 보장한다.
        await this.cache.withLock(CLEANUP_LOCK_KEY, CLEANUP_LOCK_TTL_MS, async () => {
            const expiresBefore = this.getExpirationThreshold()
            const expiredAssets = await this.repository.findExpiredIncomplete(expiresBefore)

            if (0 < expiredAssets.length) {
                await this.deleteMany(pickIds(expiredAssets))
            }
        })
    }

    async create(createDto: CreateAssetDto): Promise<AssetPresignedUploadDto> {
        const asset = await this.repository.create(createDto)

        const { mimeType, size } = createDto
        const expiresInSec = this.config.asset.uploadExpiresInSec

        const presigned = await this.s3Service.presignUploadPost({
            contentType: mimeType,
            expiresInSec,
            key: asset.id,
            maxContentLength: size,
            minContentLength: size
        })

        const expiresAt = this.getUploadExpiresAt(asset.createdAt)

        return {
            assetId: asset.id,
            expiresAt,
            fields: presigned.fields,
            method: 'POST' as const,
            url: presigned.url
        }
    }

    async deleteMany(assetIds: string[]): Promise<void> {
        if (assetIds.length === 0) return

        // S3 한 건이 실패해도 나머지 객체 삭제 시도는 끝까지 진행한다 (Promise.all 처럼
        // 한 번 reject 됐다고 다른 in-flight 결과를 무시하지 않음). 단, 어느 하나라도
        // 실패했다면 DB 행은 그대로 두고 첫 실패를 throw — 호출자(cleanup cron 등)가
        // 다음 회차에 같은 자산을 다시 들고 들어와 재시도할 수 있도록 한다. 그래야
        // S3 객체가 DB 참조 없이 영구 고아가 되는 상황이 막힌다.
        const results = await Promise.allSettled(
            assetIds.map((assetId) => this.s3Service.deleteObject(assetId))
        )
        const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        if (failed.length > 0) {
            this.logger.warn('partial S3 delete failure; DB rows retained for retry', {
                failedCount: failed.length,
                reasons: failed.map((r) => getByPath(r, 'reason.message', String(r.reason))),
                totalCount: assetIds.length
            })
            throw failed[0].reason
        }

        await this.repository.deleteByIds(assetIds)
    }

    async finalizeUpload(assetId: string, { owner }: FinalizeAssetDto) {
        const asset = await this.repository.getById(assetId)
        const expiresAt = this.getUploadExpiresAt(asset.createdAt)

        if (this.isUploadExpired(expiresAt)) {
            // S3 → DB 순서 (deleteMany 와 동일). 반대로 하면 DB 삭제 후 S3 실패 시
            // cleanup cron 이 DB 만 보기 때문에 S3 객체가 영구 고아가 된다.
            await this.deleteMany([assetId])

            throw new NotFoundException(AssetErrors.UploadExpired(assetId, expiresAt))
        }

        const updatedAsset = await this.repository.assignOwner(assetId, owner)

        const dto = this.toDto(updatedAsset)
        return this.withDownloadInfo(dto)
    }

    async findMany(assetIds: string[]) {
        const assets = await this.repository.findByIds(assetIds)

        const dtos = this.toDtos(assets)
        return Promise.all(dtos.map((dto) => this.withDownloadInfo(dto)))
    }

    async getMany(assetIds: string[]) {
        const assets = await this.repository.getByIds(assetIds)

        const dtos = this.toDtos(assets)
        return Promise.all(dtos.map((dto) => this.withDownloadInfo(dto)))
    }

    async isUploadComplete(assetId: string): Promise<boolean> {
        const { id, mimeType, size } = await this.repository.getById(assetId)

        return this.s3Service.isUploadComplete({
            contentLength: size,
            contentType: mimeType,
            key: id
        })
    }

    private getExpirationThreshold() {
        return DateUtil.add({
            base: DateUtil.now(),
            seconds: -this.config.asset.uploadExpiresInSec
        })
    }

    private getUploadExpiresAt(createdAt: Date) {
        return DateUtil.add({ base: createdAt, seconds: this.config.asset.uploadExpiresInSec })
    }

    private isUploadExpired(expiresAt: Date) {
        return expiresAt.getTime() <= DateUtil.now().getTime()
    }

    private toDto(asset: Asset): AssetDto {
        return this.toDtos([asset])[0]
    }

    private toDtos(assets: Asset[]) {
        return assets.map((asset) => {
            const dto = mapDocToDto(asset, AssetDto, [
                'id',
                'originalName',
                'mimeType',
                'size',
                'checksum'
            ])

            dto.download = null
            dto.owner = null

            if (asset.ownerService && asset.ownerEntityId) {
                dto.owner = { entityId: asset.ownerEntityId, service: asset.ownerService }
            }

            return dto
        })
    }

    private async withDownloadInfo(assetDto: AssetDto): Promise<AssetDto> {
        const expiresInSec = this.config.asset.downloadExpiresInSec
        const url = await this.s3Service.presignDownloadUrl({ expiresInSec, key: assetDto.id })
        const expiresAt = DateUtil.add({ seconds: expiresInSec })

        return { ...assetDto, download: { expiresAt, url } }
    }
}
