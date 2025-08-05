import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { PurchaseProcessClient } from 'apps/applications'
import { CreatePurchaseRecordDto, PurchaseRecordsClient } from 'apps/cores'

@Controller('purchases')
export class PurchasesController {
    constructor(
        private purchasesService: PurchaseRecordsClient,
        private purchaseProcessService: PurchaseProcessClient
    ) {}

    @Post()
    async processPurchase(@Body() createDto: CreatePurchaseRecordDto) {
        return this.purchaseProcessService.processPurchase(createDto)
    }

    @Get(':purchaseId')
    async getPurchase(@Param('purchaseId') purchaseId: string) {
        const purchases = await this.purchasesService.getPurchases([purchaseId])
        return purchases[0]
    }
}
