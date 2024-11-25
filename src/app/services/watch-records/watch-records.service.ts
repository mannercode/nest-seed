import { Injectable } from '@nestjs/common'
import { MethodLog, toDto, toDtos } from 'common'
import { WatchRecordCreateDto, WatchRecordDto, WatchRecordQueryDto } from './dtos'
import { WatchRecordsRepository } from './watch-records.repository'

@Injectable()
export class WatchRecordsService {
    constructor(private repository: WatchRecordsRepository) {}

    @MethodLog()
    async createWatchRecord(createDto: WatchRecordCreateDto) {
        const watchRecord = await this.repository.createWatchRecord(createDto)

        return toDto(watchRecord, WatchRecordDto)
    }

    @MethodLog({ level: 'verbose' })
    async findWatchRecords(queryDto: WatchRecordQueryDto) {
        const { items, ...paginated } = await this.repository.findWatchRecords(queryDto)

        return { ...paginated, items: toDtos(items, WatchRecordDto) }
    }
}
