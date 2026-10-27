import {
    CacheService,
    DateUtil,
    ensure,
    getByPath,
    InjectCache,
    InjectS3Object,
    mapDocToDto,
    pickIds,
    S3ObjectService,
    MongoErrors,
    type TransactionContext
} from '@mannercode/common'
import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { AppConfigService } from '#config'
import { AssetsRepository } from './assets.repository.js'
import {
    AssetPresignedUploadDto,
    CreateAssetDto,
    FinalizeAssetDto,
    AssetDto,
    AssetSchema
} from './dtos/index.js'
import { AssetErrors } from './errors.js'
import { Asset } from './models/index.js'

const CLEANUP_LOCK_KEY = 'cleanup-expired-uploads'
// 실행 중 락이 만료되어도 삭제 상태와 멱등 삭제로 중첩 실행을 처리한다.
const CLEANUP_LOCK_TTL_MS = 5 * 60 * 1000

@Injectable()
export class AssetsService {
    private readonly logger = new Logger(AssetsService.name)

    constructor(
        private readonly repository: AssetsRepository,
        @InjectS3Object() private readonly s3Service: S3ObjectService,
        @InjectCache('assets') private readonly cache: CacheService,
        private readonly config: AppConfigService
    ) {}

    async cleanupExpiredUploads() {
        // 모든 복제본이 실행하므로 한 복제본만 작업하도록 분산 락을 쓴다.
        await this.cache.withLock(CLEANUP_LOCK_KEY, CLEANUP_LOCK_TTL_MS, async () => {
            const expiresBefore = this.getExpirationThreshold()
            await this.repository.requestExpiredDeletion(expiresBefore)
            const expiredAssets = await this.repository.findPendingDeletion(expiresBefore)

            if (0 < expiredAssets.length) {
                const assetIds = pickIds(expiredAssets)
                await this.deleteMany(assetIds)
                // 삭제 후에도 이미 발급한 업로드 요청은 유효하다. 삭제 시점부터 업로드
                // 유효기간이 지난 기록만 재정리를 마친 것으로 표시한다.
                await this.repository.markStorageCleaned(assetIds, expiresBefore)
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

        await this.repository.requestDeletion(assetIds)

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

        await this.repository.deleteMany({ ids: assetIds })
    }

    async finalizeUpload(assetId: string, { owner }: FinalizeAssetDto) {
        // 만료 판정과 소유 부여를 조건부 원자 갱신 하나로 처리한다.
        // 시각을 먼저 검사하고 나중에 소유를 쓰면, 그 틈에 정리 cron이 같은 자산의 S3 객체를 지울 수 있다.
        const updatedAsset = await this.repository.assignOwner(
            assetId,
            owner,
            this.getExpirationThreshold()
        )

        if (!updatedAsset) {
            const asset = await this.repository.get({ id: assetId })
            if (asset.deletionRequestedAt) {
                throw new NotFoundException(MongoErrors.DocumentNotFound(assetId))
            }
            if (asset.ownerEntityId !== null) {
                throw new ConflictException(AssetErrors.AlreadyOwned(assetId))
            }
            // 만료된 무소유 자산은 정리 cron이 처리한다. 완료 실패를 삭제 명령으로 해석하지 않는다.
            const expiresAt = this.getUploadExpiresAt(asset.createdAt)
            throw new NotFoundException(AssetErrors.UploadExpired(assetId, expiresAt))
        }

        const dto = this.toDto(updatedAsset)
        return this.withDownloadInfo(dto)
    }

    async confirmOwner(
        assetId: string,
        owner: { entityId: string; service: string },
        transaction: TransactionContext
    ): Promise<void> {
        if (!(await this.repository.confirmOwner(assetId, owner, transaction))) {
            throw new NotFoundException(MongoErrors.DocumentNotFound(assetId))
        }
    }

    async findMany(assetIds: string[]) {
        const assets = await this.repository.findMany({ ids: assetIds })

        const dtos = this.toDtos(assets)
        return Promise.all(dtos.map((dto) => this.withDownloadInfo(dto)))
    }

    async getMany(assetIds: string[]) {
        const assets = await this.repository.getMany({ ids: assetIds })

        const dtos = this.toDtos(assets)
        return Promise.all(dtos.map((dto) => this.withDownloadInfo(dto)))
    }

    async findOwner(
        assetId: string
    ): Promise<{ entityId: string; service: string } | null | undefined> {
        const asset = await this.repository.find({ id: assetId })

        if (!asset) return undefined

        return this.toOwner(asset)
    }

    async findOwners(
        assetIds: string[]
    ): Promise<Map<string, { entityId: string; service: string } | null>> {
        const assets = await this.repository.findMany({ ids: assetIds })

        return new Map(assets.map((asset) => [asset.id, this.toOwner(asset)]))
    }

    async isUploadComplete(assetId: string): Promise<boolean> {
        const { id, mimeType, size, deletionRequestedAt } = await this.repository.get({
            id: assetId
        })
        if (deletionRequestedAt) {
            throw new NotFoundException(MongoErrors.DocumentNotFound(assetId))
        }

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

    private getUploadExpiresAt(createdAt: Temporal.Instant) {
        return DateUtil.add({ base: createdAt, seconds: this.config.asset.uploadExpiresInSec })
    }

    private toDto(asset: Asset): AssetDto {
        return mapDocToDto({ ...asset, download: null, owner: this.toOwner(asset) }, AssetSchema)
    }

    private toDtos(assets: Asset[]) {
        return assets.map((asset) => this.toDto(asset))
    }

    private toOwner(asset: Asset): { entityId: string; service: string } | null {
        if (!asset.ownerEntityId || !asset.ownerService) return null

        return { entityId: asset.ownerEntityId, service: asset.ownerService }
    }

    private async withDownloadInfo(assetDto: AssetDto): Promise<AssetDto> {
        const expiresInSec = this.config.asset.downloadExpiresInSec
        const url = await this.s3Service.presignDownloadUrl({ expiresInSec, key: assetDto.id })
        const expiresAt = DateUtil.add({ seconds: expiresInSec })

        return { ...assetDto, download: { expiresAt, url } }
    }
}
