import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { CreatePurchaseDto, PurchaseClient } from 'applications'
import { PurchaseRecordsClient } from 'cores'

@Controller('purchases')
export class PurchaseHttpController {
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
