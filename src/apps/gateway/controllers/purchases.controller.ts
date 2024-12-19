import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { PurchaseCreateDto } from 'cores'
import { PurchaseProcessService, PurchasesService } from 'proxy'

@Controller('purchases')
export class PurchasesController {
    constructor(
        private purchasesService: PurchasesService,
        private processService: PurchaseProcessService
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
