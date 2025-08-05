import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { CreatePurchaseDto, PurchaseClient } from 'apps/applications'
import { PurchaseRecordsClient } from 'apps/cores'

@Controller('purchases')
export class PurchasesController {
    constructor(
        private purchasesService: PurchaseRecordsClient,
        private purchaseProcessService: PurchaseClient
    ) {}

    @Post()
    async processPurchase(@Body() createDto: CreatePurchaseDto) {
        return this.purchaseProcessService.processPurchase(createDto)
    }

    @Get(':purchaseId')
    async getPurchase(@Param('purchaseId') purchaseId: string) {
        const purchases = await this.purchasesService.getPurchases([purchaseId])
        return purchases[0]
    }
}
