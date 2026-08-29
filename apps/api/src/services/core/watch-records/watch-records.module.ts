import { Module } from '@nestjs/common'
import { WatchRecordsRepository } from './watch-records.repository.js'
import { WatchRecordsService } from './watch-records.service.js'

@Module({
    exports: [WatchRecordsService],
    providers: [WatchRecordsService, WatchRecordsRepository]
})
export class WatchRecordsModule {}
