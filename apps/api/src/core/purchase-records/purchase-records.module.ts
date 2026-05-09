import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MongooseConfigModule } from 'shared'
import { PurchaseRecord, PurchaseRecordSchema } from './models'
import { PurchaseRecordsRepository } from './purchase-records.repository'
import { PurchaseRecordsService } from './purchase-records.service'

@Module({
    exports: [PurchaseRecordsService],
    imports: [
        MongooseModule.forFeature(
            [{ name: PurchaseRecord.name, schema: PurchaseRecordSchema }],
            MongooseConfigModule.connectionName
        )
    ],
    providers: [PurchaseRecordsService, PurchaseRecordsRepository]
})
export class PurchaseRecordsModule {}
