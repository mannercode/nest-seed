import {
    CacheService,
    DateUtil,
    ensure,
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
// 정상 정리보다 길고, 소유 컨테이너가 죽었을 때 다음 cron이 재획득할 만큼 짧게 둔다.
const CLEANUP_LOCK_TTL_MS = 5 * 60 * 1000

// @Cron은 DI보다 먼저 평가되므로 코드 상수를 쓴다.
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
        // 모든 복제본이 실행하므로 한 복제본만 작업하도록 분산 락을 쓴다.
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

        const { checksum, mimeType, size } = createDto
        const expiresInSec = this.config.asset.uploadExpiresInSec

        // checksum을 presign 조건에 넣어 신고한 값과 다른 본문을 스토리지에서 거절한다.
        const presigned = await this.s3Service.presignUploadPost({
            checksum,
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

        // S3 삭제는 모두 시도하되 하나라도 실패하면 재시도 기준인 DB 행을 남긴다.
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
            throw ensure(failed[0]).reason
        }

        await this.repository.deleteByIds(assetIds)
    }

    async finalizeUpload(assetId: string, { owner }: FinalizeAssetDto) {
        const asset = await this.repository.getById(assetId)

        // 만료 판정과 소유 부여를 조건부 원자 갱신 하나로 처리한다.
        // 시각을 먼저 검사하고 나중에 소유를 쓰면, 그 틈에 정리 cron이 같은 자산의 S3 객체를 지울 수 있다.
        const updatedAsset = await this.repository.assignOwner(
            assetId,
            owner,
            this.getExpirationThreshold()
        )

        if (!updatedAsset) {
            // S3 객체를 먼저 삭제해야 DB 삭제 후 S3 삭제 실패로 고립 객체가 남는 상황을 피할 수 있다.
            // 정리 cron은 DB를 기준으로 만료 자산을 찾는다. 이미 cron이 지웠다면 두 삭제 모두 멱등이다.
            await this.deleteMany([assetId])

            const expiresAt = this.getUploadExpiresAt(asset.createdAt)
            throw new NotFoundException(AssetErrors.UploadExpired(assetId, expiresAt))
        }

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

    private toDto(asset: Asset): AssetDto {
        return ensure(this.toDtos([asset])[0])
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
