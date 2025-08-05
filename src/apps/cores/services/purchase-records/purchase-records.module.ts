import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MongooseConfigModule } from 'shared'
import { PurchaseRecord, PurchaseRecordSchema } from './models'
import { PurchaseRecordsController } from './purchase-records.controller'
import { PurchasesRecordRepository } from './purchase-records.repository'
import { PurchaseRecordsService } from './purchase-records.service'

@Module({
    imports: [
        MongooseModule.forFeature(
            [{ name: PurchaseRecord.name, schema: PurchaseRecordSchema }],
            MongooseConfigModule.connectionName
        )
    ],
    providers: [PurchaseRecordsService, PurchasesRecordRepository],
    controllers: [PurchaseRecordsController]
})
export class PurchaseRecordsModule {}
