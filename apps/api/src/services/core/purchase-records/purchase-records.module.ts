import { Module } from '@nestjs/common'
import { PurchaseRecordsRepository } from './purchase-records.repository.js'
import { PurchaseRecordsService } from './purchase-records.service.js'

@Module({
    exports: [PurchaseRecordsService],
    providers: [PurchaseRecordsService, PurchaseRecordsRepository]
})
export class PurchaseRecordsModule {}
