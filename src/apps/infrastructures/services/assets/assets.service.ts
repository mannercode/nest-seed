import { Injectable } from '@nestjs/common'
import { DateUtil, hexToBase64, InjectS3Object, mapDocToDto, S3ObjectService } from 'common'
import { Rules } from 'shared'
import { AssetsRepository } from './assets.repository'
import { AssetDto, CompleteAssetDto, CreateAssetDto, CreateAssetResponse } from './dtos'
import { AssetDocument } from './models'

@Injectable()
export class AssetsService {
    constructor(
        private readonly repository: AssetsRepository,
        @InjectS3Object() private readonly s3Service: S3ObjectService
    ) {}

    async create(createDto: CreateAssetDto): Promise<CreateAssetResponse> {
        const asset = await this.repository.createAsset(createDto)

        const { mimeType, size } = createDto
        const expiresInSec = Rules.Asset.uploadExpiresInSec

        const url = await this.s3Service.presignUploadUrl({
            key: asset.id,
            expiresInSec,
            contentType: mimeType,
            contentLength: size
        })

        const expiresAt = DateUtil.add({ seconds: expiresInSec })
        const { algorithm, hex } = createDto.checksum

        return {
            assetId: asset.id,
            uploadRequest: {
                method: 'PUT' as const,
                url,
                expiresAt,
                headers: {
                    'Content-Type': mimeType,
                    'Content-Length': size.toString(),
                    [`x-amz-checksum-${algorithm}`]: hexToBase64(hex)
                }
            }
        }
    }

    async complete(assetId: string, completeDto: CompleteAssetDto) {
        const asset = await this.repository.update(assetId, completeDto)

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
}
