import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MONGO_CONNECTION_NAME } from '#config'
import { WatchRecord, WatchRecordSchema } from './models/index.js'
import { WatchRecordsRepository } from './watch-records.repository.js'
import { WatchRecordsService } from './watch-records.service.js'

@Module({
    exports: [WatchRecordsService],
    imports: [
        MongooseModule.forFeature(
            [{ name: WatchRecord.name, schema: WatchRecordSchema }],
            MONGO_CONNECTION_NAME
        )
    ],
    providers: [WatchRecordsService, WatchRecordsRepository]
})
export class WatchRecordsModule {}
