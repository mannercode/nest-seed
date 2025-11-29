import { Body, Controller, Post } from '@nestjs/common'
import { AssetsClient, CreateAssetDto } from 'apps/infrastructures'

@Controller('assets')
export class AssetsController {
    constructor(private assetsService: AssetsClient) {}

    @Post()
    create(@Body() body: CreateAssetDto) {
        return this.assetsService.create(body)
    }
}
