import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MongooseConfigModule } from 'shared'
import { WatchRecord, WatchRecordSchema } from './models'
import { WatchRecordsRepository } from './watch-records.repository'
import { WatchRecordsService } from './watch-records.service'

@Module({
    exports: [WatchRecordsService],
    imports: [
        MongooseModule.forFeature(
            [{ name: WatchRecord.name, schema: WatchRecordSchema }],
            MongooseConfigModule.connectionName
        )
    ],
    providers: [WatchRecordsService, WatchRecordsRepository]
})
export class WatchRecordsModule {}
