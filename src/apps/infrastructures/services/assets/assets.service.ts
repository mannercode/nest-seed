import { S3ObjectService } from '@mannercode/nestlib-common'
import { DateUtil, InjectS3Object, mapDocToDto, pickIds } from '@mannercode/nestlib-common'
import { Injectable, NotFoundException } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { Rules } from 'shared'
import { AssetsRepository } from './assets.repository'
import { AssetPresignedUploadDto, CreateAssetDto, FinalizeAssetDto } from './dtos'
import { AssetDto } from './dtos'
import { AssetErrors } from './errors'
import { Asset } from './models'

@Injectable()
export class AssetsService {
    constructor(
        private readonly repository: AssetsRepository,
        @InjectS3Object() private readonly s3Service: S3ObjectService
    ) {}

    @Cron(Rules.Asset.expiredUploadCleanupCron, { name: 'assets.cleanupExpiredUploads' })
    async cleanupExpiredUploads() {
        const expiresBefore = this.getExpirationThreshold()
        const expiredAssets = await this.repository.findExpiredIncomplete(expiresBefore)

        if (0 < expiredAssets.length) {
            await this.deleteMany(pickIds(expiredAssets))
        }
    }

    async create(createDto: CreateAssetDto): Promise<AssetPresignedUploadDto> {
        const asset = await this.repository.create(createDto)

        const { mimeType, size } = createDto
        const expiresInSec = Rules.Asset.uploadExpiresInSec

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
        await Promise.all(assetIds.map((assetId) => this.s3Service.deleteObject(assetId)))

        await this.repository.deleteByIds(assetIds)
    }

    async finalizeUpload(assetId: string, { owner }: FinalizeAssetDto) {
        const asset = await this.repository.getById(assetId)
        const expiresAt = this.getUploadExpiresAt(asset.createdAt)

        if (this.isUploadExpired(expiresAt)) {
            await this.repository.deleteById(assetId)
            await this.s3Service.deleteObject(assetId)

            throw new NotFoundException(AssetErrors.UploadExpired(assetId, expiresAt))
        }

        const updatedAsset = await this.repository.assignOwner(assetId, owner)

        const dto = this.toDto(updatedAsset)
        return this.withDownloadInfo(dto)
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
        return DateUtil.add({ base: DateUtil.now(), seconds: -Rules.Asset.uploadExpiresInSec })
    }

    private getUploadExpiresAt(createdAt: Date) {
        return DateUtil.add({ base: createdAt, seconds: Rules.Asset.uploadExpiresInSec })
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
        const expiresInSec = Rules.Asset.downloadExpiresInSec
        const url = await this.s3Service.presignDownloadUrl({ expiresInSec, key: assetDto.id })
        const expiresAt = DateUtil.add({ seconds: expiresInSec })

        return { ...assetDto, download: { expiresAt, url } }
    }
}
