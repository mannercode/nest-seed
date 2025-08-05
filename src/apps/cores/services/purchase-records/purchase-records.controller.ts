import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Messages } from 'shared'
import { CreatePurchaseRecordDto } from './dtos'
import { PurchaseRecordsService } from './purchase-records.service'

@Controller()
export class PurchaseRecordsController {
    constructor(private service: PurchaseRecordsService) {}

    @MessagePattern(Messages.Purchases.createPurchseRecord)
    createPurchseRecord(@Payload() createDto: CreatePurchaseRecordDto) {
        return this.service.createPurchseRecord(createDto)
    }

    @MessagePattern(Messages.Purchases.getPurchases)
    getPurchases(@Payload() purchaseIds: string[]) {
        return this.service.getPurchases(purchaseIds)
    }
}
