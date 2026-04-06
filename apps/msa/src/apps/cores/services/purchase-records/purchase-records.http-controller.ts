import { Controller, Get, Param } from '@nestjs/common'
import { PurchaseRecordsService } from './purchase-records.service'

@Controller('purchases')
export class PurchaseRecordsHttpController {
    constructor(private readonly service: PurchaseRecordsService) {}

    @Get(':purchaseRecordId')
    async getPurchaseRecord(@Param('purchaseRecordId') purchaseRecordId: string) {
        const [purchaseRecord] = await this.service.getMany([purchaseRecordId])
        return purchaseRecord
    }
}
