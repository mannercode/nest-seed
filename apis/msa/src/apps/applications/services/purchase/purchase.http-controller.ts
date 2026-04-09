import { Body, Controller, Post } from '@nestjs/common'
import { CreatePurchaseDto } from './dtos'
import { PurchaseService } from './purchase.service'

@Controller('purchases')
export class PurchaseHttpController {
    constructor(private readonly service: PurchaseService) {}

    @Post()
    async processPurchase(@Body() createDto: CreatePurchaseDto) {
        return this.service.processPurchase(createDto)
    }
}
