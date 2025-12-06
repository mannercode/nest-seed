import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy } from 'common'
import { Messages } from 'shared'
import {
    AssetDto,
    CompleteAssetDto,
    CreateAssetDto,
    DeleteAssetsResponse,
    UploadRequest
} from './dtos'

@Injectable()
export class AssetsClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    create(dto: CreateAssetDto): Promise<UploadRequest> {
        return this.proxy.getJson(Messages.Assets.create, dto)
    }

    complete(assetId: string, completeDto: CompleteAssetDto): Promise<AssetDto> {
        return this.proxy.getJson(Messages.Assets.complete, { assetId, completeDto })
    }

    getMany(assetIds: string[]): Promise<AssetDto[]> {
        return this.proxy.getJson(Messages.Assets.getMany, assetIds)
    }

    deleteMany(assetIds: string[]): Promise<DeleteAssetsResponse> {
        return this.proxy.getJson(Messages.Assets.deleteMany, assetIds)
    }
}
