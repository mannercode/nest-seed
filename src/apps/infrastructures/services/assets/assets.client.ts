import { Injectable } from '@nestjs/common'
import { ClientProxyService } from 'common'
import { InjectClientProxy } from 'common'
import { Messages } from 'shared'
import { AssetDto, AssetPresignedUploadDto, CreateAssetDto, FinalizeAssetDto } from './dtos'

@Injectable()
export class AssetsClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    create(createDto: CreateAssetDto): Promise<AssetPresignedUploadDto> {
        return this.proxy.request(Messages.Assets.create, createDto)
    }

    async deleteMany(assetIds: string[]): Promise<void> {
        await this.proxy.request(Messages.Assets.deleteMany, assetIds)
    }

    finalizeUpload(assetId: string, finalizeDto: FinalizeAssetDto): Promise<AssetDto> {
        return this.proxy.request(Messages.Assets.finalizeUpload, { assetId, finalizeDto })
    }

    getMany(assetIds: string[]): Promise<AssetDto[]> {
        return this.proxy.request(Messages.Assets.getMany, assetIds)
    }

    isUploadComplete(assetId: string): Promise<boolean> {
        return this.proxy.request(Messages.Assets.isUploadComplete, { assetId })
    }
}
