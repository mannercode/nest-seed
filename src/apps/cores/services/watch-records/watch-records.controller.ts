import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Routes } from 'shared/config'
import { WatchRecordCreateDto, WatchRecordQueryDto } from './dtos'
import { WatchRecordsService } from './watch-records.service'

@Controller()
export class WatchRecordsController {
    constructor(private service: WatchRecordsService) {}

    @MessagePattern(Routes.Messages.WatchRecords.createWatchRecord)
    createWatchRecord(@Payload() createDto: WatchRecordCreateDto) {
        return this.service.createWatchRecord(createDto)
    }

    @MessagePattern(Routes.Messages.WatchRecords.findWatchRecords)
    findWatchRecords(@Payload() queryDto: WatchRecordQueryDto) {
        return this.service.findWatchRecords(queryDto)
    }
}
