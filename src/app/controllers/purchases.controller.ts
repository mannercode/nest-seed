import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { PurchasesService } from 'services/purchases'
import { PurchaseCreateDto } from 'services/purchases/dtos/purchase-create.dto'

@Controller('purchases')
export class PurchasesController {
    constructor(private service: PurchasesService) {}

    @Get(':purchseId')
    async getPurchase(@Param('purchseId') purchseId: string) {
        return this.service.getPurchase(purchseId)
    }

    @Post()
    async processPurchase(@Body() createDto: PurchaseCreateDto) {
        return this.service.processPurchase(createDto)
    }
}
