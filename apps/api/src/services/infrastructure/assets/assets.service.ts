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
import { AppConfigService } from 'config'
import { AssetsRepository } from './assets.repository'
import { AssetPresignedUploadDto, CreateAssetDto, FinalizeAssetDto, AssetDto } from './dtos'
import { AssetErrors } from './errors'
import { Asset } from './models'

const CLEANUP_LOCK_KEY = 'cleanup-expired-uploads'
// 락 만료 시간은 두 조건을 동시에 맞춘다. 정리 작업이 가장 오래 걸려도
// 자동 만료보다 먼저 끝날 만큼 길게 두고, 작업을 획득한 컨테이너가 종료됐을 때
// 다음 cron 한 회차 안에 다른 컨테이너가 다시 가져갈 만큼은 짧게 둔다.
const CLEANUP_LOCK_TTL_MS = 5 * 60 * 1000

// `@Cron` 데코레이터는 모듈을 읽어 들이는 시점에 평가되므로 DI로 값을
// 받아 올 수 없다. 운영에서 자주 바꿀 값도 아니라 코드 상수로 둔다.
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
        // 모든 복제본이 같은 cron을 실행한다. 그래서 실제 작업은 분산 락
        // 안에서 한다. `withLock`은 Redis `SET NX`로 락을 획득하고 토큰이
        // 일치할 때만 DEL 한다. 한 cron 회차에 한 복제본만 정리 작업을 수행한다.
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

        // S3 한 건이 실패해도 나머지 삭제는 끝까지 시도한다. `Promise.all`
        // 처럼 첫 실패에서 다른 진행 중인 호출까지 같이 버리지 않는다.
        // 다만 하나라도 실패하면 DB 행은 지우지 않고 첫 실패를 그대로
        // 던진다. 호출자(예: 정리 cron)가 다음 회차에 같은 자산을 다시
        // 처리할 수 있어야, S3 객체가 DB 참조 없이 남는 상황을
        // 막을 수 있기 때문이다.
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
            // S3 객체를 먼저 삭제해야 DB 삭제 후 S3 삭제 실패로 고립 객체가 남는
            // 상황을 피할 수 있다. 정리 cron은 DB를 기준으로 만료 자산을 찾는다.
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
