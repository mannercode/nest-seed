import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Messages } from 'shared'
import { AssetsService } from './assets.service'
import { CreateAssetDto, FinalizeAssetDto } from './dtos'

@Controller()
export class AssetsController {
    constructor(private readonly service: AssetsService) {}

    @MessagePattern(Messages.Assets.create)
    create(@Payload() createDto: CreateAssetDto) {
        return this.service.create(createDto)
    }

    @MessagePattern(Messages.Assets.deleteMany)
    async deleteMany(@Payload() assetIds: string[]): Promise<null> {
        await this.service.deleteMany(assetIds)
        return null
    }

    @MessagePattern(Messages.Assets.finalizeUpload)
    finalizeUpload(
        @Payload('assetId') assetId: string,
        @Payload('finalizeDto') finalizeDto: FinalizeAssetDto
    ) {
        return this.service.finalizeUpload(assetId, finalizeDto)
    }

    @MessagePattern(Messages.Assets.getMany)
    getMany(@Payload() assetIds: string[]) {
        return this.service.getMany(assetIds)
    }

    @MessagePattern(Messages.Assets.isUploadComplete)
    isUploadComplete(@Payload('assetId') assetId: string) {
        return this.service.isUploadComplete(assetId)
    }
}
