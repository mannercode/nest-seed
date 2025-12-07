import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Messages } from 'shared'
import { CompleteAssetDto, CreateAssetDto } from './dtos'
import { AssetsService } from './assets.service'

@Controller()
export class AssetsController {
    constructor(private readonly service: AssetsService) {}

    @MessagePattern(Messages.Assets.create)
    create(@Payload() dto: CreateAssetDto) {
        return this.service.create(dto)
    }

    @MessagePattern(Messages.Assets.complete)
    complete(
        @Payload('assetId') assetId: string,
        @Payload('completeDto') completeDto: CompleteAssetDto
    ) {
        return this.service.complete(assetId, completeDto)
    }

    @MessagePattern(Messages.Assets.getMany)
    getMany(@Payload() assetIds: string[]) {
        return this.service.getMany(assetIds)
    }

    @MessagePattern(Messages.Assets.deleteMany)
    deleteMany(@Payload() assetIds: string[]) {
        return this.service.deleteMany(assetIds)
    }

    @MessagePattern(Messages.Assets.cleanupExpiredUncompleted)
    cleanupExpiredUncompleted() {
        return this.service.cleanupExpiredUncompleted()
    }
}
