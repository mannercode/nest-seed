import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { WatchRecordCreateDto, WatchRecordQueryDto } from './dtos'
import { WatchRecordsService } from './watch-records.service'

@Controller()
export class WatchRecordsController {
    constructor(private service: WatchRecordsService) {}

    @MessagePattern('cores.watch-records.createWatchRecord')
    createWatchRecord(@Payload() createDto: WatchRecordCreateDto) {
        return this.service.createWatchRecord(createDto)
    }

    @MessagePattern('cores.watch-records.findWatchRecords')
    findWatchRecords(@Payload() queryDto: WatchRecordQueryDto) {
        return this.service.findWatchRecords(queryDto)
    }
}
