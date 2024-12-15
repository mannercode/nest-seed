import { Injectable } from '@nestjs/common'
import { MethodLog } from 'common'
import {
    nullWatchRecordDto,
    WatchRecordCreateDto,
    WatchRecordDto,
    WatchRecordQueryDto
} from 'types'

@Injectable()
export class WatchRecordsService {
    constructor() {}

    @MethodLog()
    async createWatchRecord(createDto: WatchRecordCreateDto): Promise<WatchRecordDto> {
        return nullWatchRecordDto
    }

    @MethodLog({ level: 'verbose' })
    async findWatchRecords(queryDto: WatchRecordQueryDto): Promise<WatchRecordDto[]> {
        return []
    }
}
