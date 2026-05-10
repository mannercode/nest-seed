import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MongooseSetupModule } from 'modules'
import { WatchRecord, WatchRecordSchema } from './models'
import { WatchRecordsRepository } from './watch-records.repository'
import { WatchRecordsService } from './watch-records.service'

@Module({
    exports: [WatchRecordsService],
    imports: [
        MongooseModule.forFeature(
            [{ name: WatchRecord.name, schema: WatchRecordSchema }],
            MongooseSetupModule.connectionName
        )
    ],
    providers: [WatchRecordsService, WatchRecordsRepository]
})
export class WatchRecordsModule {}
