import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Messages } from 'shared'
import { CreatePurchaseRecordDto } from './dtos'
import { PurchaseRecordsService } from './purchase-records.service'

@Controller()
export class PurchaseRecordsController {
    constructor(private service: PurchaseRecordsService) {}

    @MessagePattern(Messages.Purchases.createPurchaseRecord)
    createPurchaseRecord(@Payload() createDto: CreatePurchaseRecordDto) {
        return this.service.createPurchaseRecord(createDto)
    }

    @MessagePattern(Messages.Purchases.getPurchases)
    getPurchases(@Payload() purchaseIds: string[]) {
        return this.service.getPurchases(purchaseIds)
    }
}
