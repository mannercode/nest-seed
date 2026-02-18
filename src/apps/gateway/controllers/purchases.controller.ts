import type { CreatePurchaseDto, PurchaseClient } from 'apps/applications'
import type { PurchaseRecordsClient } from 'apps/cores'
import { Body, Controller, Get, Param, Post } from '@nestjs/common'

@Controller('purchases')
export class PurchasesController {
    constructor(
        private readonly purchaseRecordsClient: PurchaseRecordsClient,
        private readonly purchaseClient: PurchaseClient
    ) {}

    @Get(':purchaseRecordId')
    async getPurchaseRecord(@Param('purchaseRecordId') purchaseRecordId: string) {
        const [purchaseRecord] = await this.purchaseRecordsClient.getMany([purchaseRecordId])
        return purchaseRecord
    }

    @Post()
    async processPurchase(@Body() createDto: CreatePurchaseDto) {
        return this.purchaseClient.processPurchase(createDto)
    }
}
