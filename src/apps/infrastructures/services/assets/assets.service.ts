import { Injectable } from '@nestjs/common'
import { InjectS3Object, mapDocToDto, S3ObjectService } from 'common'
import { AssetsRepository } from './assets.repository'
import { AssetDto, CompleteAssetDto, CreateAssetDto, CreateAssetResponse } from './dtos'
import { AssetDocument } from './models'

const DEFAULT_PRESIGN_EXPIRES_SEC = 60

@Injectable()
export class AssetsService {
    constructor(
        private repository: AssetsRepository,
        @InjectS3Object() private s3Service: S3ObjectService
    ) {}

    async create(dto: CreateAssetDto): Promise<CreateAssetResponse> {
        const asset = await this.repository.createAsset(dto)
        const assetId = asset.id

        const expiresInSec = DEFAULT_PRESIGN_EXPIRES_SEC

        const uploadUrl = await this.s3Service.presignUploadUrl({
            key: assetId,
            expiresInSec,
            contentType: dto.mimeType,
            contentLength: dto.size
        })

        return {
            assetId,
            uploadUrl,
            expiresAt: this.getExpiresAt(expiresInSec),
            method: 'PUT' as const,
            headers: { 'Content-Type': dto.mimeType, 'Content-Length': dto.size.toString() }
        }
    }

    async complete(assetId: string, completeDto: CompleteAssetDto) {
        const asset = await this.repository.update(assetId, completeDto)

        return this.toDto(asset)
    }

    async getMany(assetIds: string[]) {
        const assets = await this.repository.getByIds(assetIds)

        return Promise.all(
            assets.map((asset) => this.toDtoWithDownloadUrl(asset, DEFAULT_PRESIGN_EXPIRES_SEC))
        )
    }

    async deleteMany(assetIds: string[]) {
        const deletedAssets = await this.repository.deleteByIds(assetIds)

        for (const assetId of assetIds) {
            await this.s3Service.deleteObject(assetId)
        }

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
            'checksum',
            'ownerService',
            'ownerEntityId'
        ])

        return dto
    }
    private async toDtoWithDownloadUrl(asset: AssetDocument, expiresInSec: number) {
        const dto = this.toDto(asset)
        const downloadUrl = await this.s3Service.presignDownloadUrl({
            key: asset.id,
            expiresInSec
        })

        dto.downloadUrl = downloadUrl
        dto.downloadUrlExpiresAt = this.getExpiresAt(expiresInSec)

        return dto
    }
    private toDtos = (assets: AssetDocument[]) => assets.map((asset) => this.toDto(asset))
}
