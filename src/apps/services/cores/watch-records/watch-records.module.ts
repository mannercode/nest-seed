import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MongooseConfig } from 'config'
import { WatchRecord, WatchRecordSchema } from './models'
import { WatchRecordsRepository } from './watch-records.repository'
import { WatchRecordsService } from './watch-records.service'
import { WatchRecordsController } from './watch-records.controller'

@Module({
    imports: [
        MongooseModule.forFeature(
            [{ name: WatchRecord.name, schema: WatchRecordSchema }],
            MongooseConfig.connName
        )
    ],
    providers: [WatchRecordsService, WatchRecordsRepository],
    controllers: [WatchRecordsController],
    exports: [WatchRecordsService]
})
export class WatchRecordsModule {}
