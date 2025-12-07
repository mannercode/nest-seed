import { GoneException, Injectable } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { DateUtil, InjectS3Object, mapDocToDto, S3ObjectService } from 'common'
import { Rules } from 'shared'
import { AssetsRepository } from './assets.repository'
import {
    AssetDto,
    CompleteAssetDto,
    CreateAssetDto,
    DeleteAssetsResponse,
    UploadRequest
} from './dtos'
import { AssetDocument } from './models'

export const AssetErrors = {
    UploadExpired: {
        code: 'ERR_ASSET_UPLOAD_EXPIRED',
        message: 'The upload request for this asset has expired.'
    }
}

@Injectable()
export class AssetsService {
    constructor(
        private readonly repository: AssetsRepository,
        @InjectS3Object() private readonly s3Service: S3ObjectService
    ) {}

    async create(createDto: CreateAssetDto): Promise<UploadRequest> {
        const asset = await this.repository.createAsset(createDto)

        const { mimeType, size } = createDto
        const expiresInSec = Rules.Asset.uploadExpiresInSec

        const url = await this.s3Service.presignUploadUrl({
            key: asset.id,
            expiresInSec,
            contentType: mimeType,
            contentLength: size
        })

        const expiresAt = this.getUploadExpiresAt(asset.createdAt)
        const { algorithm, base64 } = createDto.checksum

        return {
            assetId: asset.id,
            method: 'PUT' as const,
            url,
            expiresAt,
            headers: {
                'Content-Type': mimeType,
                'Content-Length': size.toString(),
                [`x-amz-checksum-${algorithm}`]: base64
            }
        }
    }

    async complete(assetId: string, completeDto: CompleteAssetDto) {
        const asset = await this.repository.getById(assetId)
        const expiresAt = this.getUploadExpiresAt(asset.createdAt)

        if (this.isUploadExpired(expiresAt)) {
            await this.deleteAsset(asset)

            throw new GoneException({ ...AssetErrors.UploadExpired, assetId, expiresAt })
        }

        asset.set(completeDto)
        await asset.save()

        const dto = this.toDto(asset)

        return this.withDownloadInfo(dto)
    }

    async getMany(assetIds: string[]) {
        const assets = await this.repository.getByIds(assetIds)

        const dtos = this.toDtos(assets)

        return Promise.all(dtos.map((dto) => this.withDownloadInfo(dto)))
    }

    async deleteMany(assetIds: string[]) {
        const deletedAssets = await this.repository.deleteByIds(assetIds)

        // TODO 실패 처리
        await Promise.all(deletedAssets.map((asset) => this.s3Service.deleteObject(asset.id)))

        return { deletedAssets: this.toDtos(deletedAssets) }
    }

    async cleanupExpiredUncompleted(): Promise<DeleteAssetsResponse> {
        const expireBefore = this.getExpirationThreshold()
        const expiredAssets = await this.repository.findExpiredUncompleted(expireBefore)

        if (expiredAssets.length === 0) {
            return { deletedAssets: [] }
        }

        const expiredAssetIds = expiredAssets.map((asset) => asset.id)
        return this.deleteMany(expiredAssetIds)
    }

    @Cron(CronExpression.EVERY_5_MINUTES)
    async cleanupExpiredUncompletedJob() {
        await this.cleanupExpiredUncompleted()
    }

    private toDto(asset: AssetDocument): AssetDto {
        const dto = mapDocToDto(asset, AssetDto, [
            'id',
            'originalName',
            'mimeType',
            'size',
            'checksum'
        ])

        dto.download = null
        dto.owner = null

        /* istanbul ignore else */
        if (asset.ownerService && asset.ownerEntityId) {
            dto.owner = { service: asset.ownerService, entityId: asset.ownerEntityId }
        }

        return dto
    }

    private toDtos(assets: AssetDocument[]) {
        return assets.map((asset) => this.toDto(asset))
    }

    private async withDownloadInfo(assetDto: AssetDto): Promise<AssetDto> {
        const expiresInSec = Rules.Asset.downloadExpiresInSec
        const url = await this.s3Service.presignDownloadUrl({ key: assetDto.id, expiresInSec })
        const expiresAt = DateUtil.add({ seconds: expiresInSec })

        return { ...assetDto, download: { url, expiresAt } }
    }

    private getUploadExpiresAt(createdAt: Date) {
        return DateUtil.add({ base: createdAt, seconds: Rules.Asset.uploadExpiresInSec })
    }

    private isUploadExpired(expiresAt: Date) {
        return expiresAt.getTime() <= DateUtil.now().getTime()
    }

    private async deleteAsset(asset: AssetDocument) {
        await asset.deleteOne()
        await this.s3Service.deleteObject(asset.id)
    }

    private getExpirationThreshold() {
        return DateUtil.add({ base: DateUtil.now(), seconds: -Rules.Asset.uploadExpiresInSec })
    }
}
