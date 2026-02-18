import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy } from 'common'
import { Messages } from 'shared'
import { AssetDto, FinalizeAssetDto, CreateAssetDto, AssetPresignedUploadDto } from './dtos'

@Injectable()
export class AssetsClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    create(createDto: CreateAssetDto): Promise<AssetPresignedUploadDto> {
        return this.proxy.request(Messages.Assets.create, createDto)
    }

    isUploadComplete(assetId: string): Promise<boolean> {
        return this.proxy.request(Messages.Assets.isUploadComplete, { assetId })
    }

    finalizeUpload(assetId: string, finalizeDto: FinalizeAssetDto): Promise<AssetDto> {
        return this.proxy.request(Messages.Assets.finalizeUpload, { assetId, finalizeDto })
    }

    getMany(assetIds: string[]): Promise<AssetDto[]> {
        return this.proxy.request(Messages.Assets.getMany, assetIds)
    }

    async deleteMany(assetIds: string[]): Promise<void> {
        await this.proxy.request(Messages.Assets.deleteMany, assetIds)
    }
}
