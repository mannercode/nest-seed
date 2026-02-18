import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Messages } from 'shared'
import type { CreatePurchaseRecordDto } from './dtos'
import type { PurchaseRecordsService } from './purchase-records.service'

@Controller()
export class PurchaseRecordsController {
    constructor(private readonly service: PurchaseRecordsService) {}

    @MessagePattern(Messages.PurchaseRecords.create)
    create(@Payload() createDto: CreatePurchaseRecordDto) {
        return this.service.create(createDto)
    }

    @MessagePattern(Messages.PurchaseRecords.getMany)
    getMany(@Payload() purchaseRecordIds: string[]) {
        return this.service.getMany(purchaseRecordIds)
    }
}
