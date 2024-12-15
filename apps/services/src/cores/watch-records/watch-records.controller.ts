import { Injectable } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { WatchRecordCreateDto, WatchRecordQueryDto } from 'types'
import { WatchRecordsService } from './watch-records.service'

@Injectable()
export class WatchRecordsController {
    constructor(private service: WatchRecordsService) {}

    @MessagePattern({ cmd: 'createWatchRecord' })
    async createWatchRecord(@Payload() createDto: WatchRecordCreateDto) {
        return this.service.createWatchRecord(createDto)
    }

    @MessagePattern({ cmd: 'findWatchRecords' })
    async findWatchRecords(@Payload() queryDto: WatchRecordQueryDto) {
        return this.service.findWatchRecords(queryDto)
    }
}
