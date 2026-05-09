import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { CreatePurchaseDto, PurchaseService } from 'application'
import { PurchaseRecordsService } from 'core'

@Controller('purchases')
export class PurchaseHttpController {
    constructor(
        private readonly purchaseRecordsService: PurchaseRecordsService,
        private readonly purchaseService: PurchaseService
    ) {}

    @Get(':purchaseRecordId')
    async getPurchaseRecord(@Param('purchaseRecordId') purchaseRecordId: string) {
        const [purchaseRecord] = await this.purchaseRecordsService.getMany([purchaseRecordId])
        return purchaseRecord
    }

    @Post()
    async processPurchase(@Body() createDto: CreatePurchaseDto) {
        return this.purchaseService.processPurchase(createDto)
    }
}
