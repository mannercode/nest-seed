import { Injectable, NotFoundException } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { DateUtil, InjectS3Object, mapDocToDto, pickIds, S3ObjectService } from 'common'
import { Rules } from 'shared'
import { AssetsRepository } from './assets.repository'
import { AssetDto, AssetPresignedUploadDto, CompleteAssetDto, CreateAssetDto } from './dtos'
import { Asset } from './models'

export const AssetServiceErrors = {
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

    async create(createDto: CreateAssetDto): Promise<AssetPresignedUploadDto> {
        const asset = await this.repository.create(createDto)

        const { mimeType, size } = createDto
        const expiresInSec = Rules.Asset.uploadExpiresInSec

        const presigned = await this.s3Service.presignUploadPost({
            key: asset.id,
            expiresInSec,
            contentType: mimeType,
            minContentLength: size,
            maxContentLength: size
        })

        const expiresAt = this.getUploadExpiresAt(asset.createdAt)

        return {
            assetId: asset.id,
            method: 'POST' as const,
            url: presigned.url,
            fields: presigned.fields,
            expiresAt
        }
    }

    async complete(assetId: string, { owner }: CompleteAssetDto) {
        const asset = await this.repository.getById(assetId)
        const expiresAt = this.getUploadExpiresAt(asset.createdAt)

        if (this.isUploadExpired(expiresAt)) {
            await this.repository.deleteById(assetId)
            await this.s3Service.deleteObject(assetId)

            throw new NotFoundException({ ...AssetServiceErrors.UploadExpired, assetId, expiresAt })
        }

        const updatedAsset = await this.repository.assignOwner(assetId, owner)

        const dto = this.toDto(updatedAsset)
        return this.withDownloadInfo(dto)
    }

    async isUploadComplete(assetId: string): Promise<boolean> {
        const { id, mimeType, size } = await this.repository.getById(assetId)

        return this.s3Service.isUploadComplete({
            key: id,
            contentType: mimeType,
            contentLength: size
        })
    }

    async getMany(assetIds: string[]) {
        const assets = await this.repository.getByIds(assetIds)

        const dtos = this.toDtos(assets)
        return Promise.all(dtos.map((dto) => this.withDownloadInfo(dto)))
    }

    async deleteMany(assetIds: string[]) {
        await this.repository.deleteByIds(assetIds)

        await Promise.all(assetIds.map((assetId) => this.s3Service.deleteObject(assetId)))
        return {}
    }

    @Cron(Rules.Asset.expiredUploadCleanupCron, { name: 'assets.cleanupExpiredUploads' })
    async cleanupExpiredUploads() {
        const expireBefore = this.getExpirationThreshold()
        const expiredAssets = await this.repository.findExpiredUncompleted(expireBefore)

        if (0 < expiredAssets.length) {
            await this.deleteMany(pickIds(expiredAssets))
        }
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

    private getExpirationThreshold() {
        return DateUtil.add({ base: DateUtil.now(), seconds: -Rules.Asset.uploadExpiresInSec })
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
                dto.owner = { service: asset.ownerService, entityId: asset.ownerEntityId }
            }

            return dto
        })
    }
}
