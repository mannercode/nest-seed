import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { CreatePurchaseDto, PurchaseClient } from 'apps/applications'
import { PurchaseRecordsClient } from 'apps/cores'

@Controller('purchases')
export class PurchasesController {
    constructor(
        private readonly purchaseRecordsClient: PurchaseRecordsClient,
        private readonly purchaseClient: PurchaseClient
    ) {}

    @Post()
    async processPurchase(@Body() createDto: CreatePurchaseDto) {
        return this.purchaseClient.processPurchase(createDto)
    }

    @Get(':purchaseId')
    async getPurchase(@Param('purchaseId') purchaseId: string) {
        const purchases = await this.purchaseRecordsClient.getMany([purchaseId])
        return purchases[0]
    }
}
