import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy } from 'common'
import { Messages } from 'shared'
import { AssetDto, CompleteAssetDto, CreateAssetDto, AssetPresignedUploadDto } from './dtos'

@Injectable()
export class AssetsClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    create(dto: CreateAssetDto): Promise<AssetPresignedUploadDto> {
        return this.proxy.getJson(Messages.Assets.create, dto)
    }

    isUploadComplete(assetId: string): Promise<boolean> {
        return this.proxy.getJson(Messages.Assets.isUploadComplete, { assetId })
    }

    complete(assetId: string, completeDto: CompleteAssetDto): Promise<AssetDto> {
        return this.proxy.getJson(Messages.Assets.complete, { assetId, completeDto })
    }

    getMany(assetIds: string[]): Promise<AssetDto[]> {
        return this.proxy.getJson(Messages.Assets.getMany, assetIds)
    }

    deleteMany(assetIds: string[]): Promise<Record<string, never>> {
        return this.proxy.getJson(Messages.Assets.deleteMany, assetIds)
    }
}
