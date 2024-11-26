import { Injectable } from '@nestjs/common'
import { MethodLog } from 'common'
import { WatchRecordCreateDto, WatchRecordQueryDto } from './dtos'
import { WatchRecordDocument, WatchRecordDto } from './models'
import { WatchRecordsRepository } from './watch-records.repository'

@Injectable()
export class WatchRecordsService {
    constructor(private repository: WatchRecordsRepository) {}

    @MethodLog()
    async createWatchRecord(createDto: WatchRecordCreateDto) {
        const watchRecord = await this.repository.createWatchRecord(createDto)

        return this.toDto(watchRecord)
    }

    @MethodLog({ level: 'verbose' })
    async findWatchRecords(queryDto: WatchRecordQueryDto) {
        const { items, ...paginated } = await this.repository.findWatchRecords(queryDto)

        return { ...paginated, items: this.toDtos(items) }
    }

    private toDto = (watchRecord: WatchRecordDocument) => watchRecord.toJSON<WatchRecordDto>()
    private toDtos = (watchRecords: WatchRecordDocument[]) =>
        watchRecords.map((watchRecord) => this.toDto(watchRecord))
}
