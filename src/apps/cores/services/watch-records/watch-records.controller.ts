import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Subjects } from 'shared/config'
import { WatchRecordCreateDto, WatchRecordQueryDto } from './dtos'
import { WatchRecordsService } from './watch-records.service'

@Controller()
export class WatchRecordsController {
    constructor(private service: WatchRecordsService) {}

    @MessagePattern(Subjects.WatchRecords.createWatchRecord)
    createWatchRecord(@Payload() createDto: WatchRecordCreateDto) {
        return this.service.createWatchRecord(createDto)
    }

    @MessagePattern(Subjects.WatchRecords.findWatchRecords)
    findWatchRecords(@Payload() queryDto: WatchRecordQueryDto) {
        return this.service.findWatchRecords(queryDto)
    }
}
