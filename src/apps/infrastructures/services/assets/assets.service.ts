import { Injectable } from '@nestjs/common'
import { InjectS3Object, mapDocToDto, S3ObjectService } from 'common'
import { Rules } from 'shared'
import { AssetsRepository } from './assets.repository'
import { AssetDto, CompleteAssetDto, CreateAssetDto, CreateAssetResponse } from './dtos'
import { AssetDocument } from './models'

@Injectable()
export class AssetsService {
    constructor(
        private repository: AssetsRepository,
        @InjectS3Object() private s3Service: S3ObjectService
    ) {}

    async create(dto: CreateAssetDto): Promise<CreateAssetResponse> {
        const asset = await this.repository.createAsset(dto)

        const expiresInSec = Rules.Asset.uploadExpiresInSec

        const url = await this.s3Service.presignUploadUrl({
            key: asset.id,
            expiresInSec,
            contentType: dto.mimeType,
            contentLength: dto.size
        })
        const expiresAt = this.getExpiresAt(expiresInSec)

        return {
            assetId: asset.id,
            upload: { url, expiresAt },
            method: 'PUT' as const,
            headers: { 'Content-Type': dto.mimeType, 'Content-Length': dto.size.toString() }
        }
    }

    async complete(assetId: string, completeDto: CompleteAssetDto) {
        const asset = await this.repository.update(assetId, completeDto)

        const dto = this.toDto(asset)
        await this.updateDownloadInfo(dto)

        return dto
    }

    async getMany(assetIds: string[]) {
        const assets = await this.repository.getByIds(assetIds)

        const dtos = this.toDtos(assets)
        await Promise.all(dtos.map((dto) => this.updateDownloadInfo(dto)))

        return dtos
    }

    async deleteMany(assetIds: string[]) {
        const deletedAssets = await this.repository.deleteByIds(assetIds)

        await Promise.all(deletedAssets.map((asset) => this.s3Service.deleteObject(asset.id)))

        return { deletedAssets: this.toDtos(deletedAssets) }
    }

    private getExpiresAt(expiresInSec: number) {
        return new Date(Date.now() + expiresInSec * 1000)
    }

    private toDto = (asset: AssetDocument): AssetDto => {
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
    private toDtos = (assets: AssetDocument[]) => assets.map((asset) => this.toDto(asset))

    private updateDownloadInfo = async (assetDto: AssetDto) => {
        const expiresInSec = Rules.Asset.downloadExpiresInSec

        const url = await this.s3Service.presignDownloadUrl({ key: assetDto.id, expiresInSec })
        const expiresAt = this.getExpiresAt(expiresInSec)
        assetDto.download = { url, expiresAt }

        return assetDto
    }
}
