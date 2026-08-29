import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MONGO_CONNECTION_NAME } from '#config'
import { PurchaseRecord, PurchaseRecordSchema } from './models/index.js'
import { PurchaseRecordsRepository } from './purchase-records.repository.js'
import { PurchaseRecordsService } from './purchase-records.service.js'

@Module({
    exports: [PurchaseRecordsService],
    imports: [
        MongooseModule.forFeature(
            [{ name: PurchaseRecord.name, schema: PurchaseRecordSchema }],
            MONGO_CONNECTION_NAME
        )
    ],
    providers: [PurchaseRecordsService, PurchaseRecordsRepository]
})
export class PurchaseRecordsModule {}
