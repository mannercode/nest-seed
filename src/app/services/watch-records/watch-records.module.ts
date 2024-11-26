import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { WatchRecord, WatchRecordSchema } from './models'
import { WatchRecordsRepository } from './watch-records.repository'
import { WatchRecordsService } from './watch-records.service'

@Module({
    imports: [MongooseModule.forFeature([{ name: WatchRecord.name, schema: WatchRecordSchema }])],
    providers: [WatchRecordsService, WatchRecordsRepository],
    exports: [WatchRecordsService]
})
export class WatchRecordsModule {}
