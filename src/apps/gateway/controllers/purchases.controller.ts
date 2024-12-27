import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { PurchaseProcessProxy } from 'applications'
import { PurchaseCreateDto, PurchasesProxy } from 'cores'

@Controller('purchases')
export class PurchasesController {
    constructor(
        private purchasesService: PurchasesProxy,
        private processService: PurchaseProcessProxy
    ) {}

    @Post()
    async processPurchase(@Body() createDto: PurchaseCreateDto) {
        return this.processService.processPurchase(createDto)
    }

    @Get(':purchseId')
    async getPurchase(@Param('purchseId') purchseId: string) {
        return this.purchasesService.getPurchase(purchseId)
    }
}
