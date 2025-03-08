import { Injectable } from '@nestjs/common'
import { mapDocToDto } from 'common'
import { WatchRecordCreateDto, WatchRecordDto, WatchRecordQueryDto } from './dtos'
import { WatchRecordDocument } from './models'
import { WatchRecordsRepository } from './watch-records.repository'

@Injectable()
export class WatchRecordsService {
    constructor(private repository: WatchRecordsRepository) {}

    async createWatchRecord(createDto: WatchRecordCreateDto) {
        const watchRecord = await this.repository.createWatchRecord(createDto)

        return this.toDto(watchRecord)
    }

    async findWatchRecords(queryDto: WatchRecordQueryDto) {
        const { items, ...paginated } = await this.repository.findWatchRecords(queryDto)

        return { ...paginated, items: this.toDtos(items) }
    }

    private toDto = (watchRecord: WatchRecordDocument) =>
        mapDocToDto(watchRecord, WatchRecordDto, [
            'id',
            'customerId',
            'movieId',
            'purchaseId',
            'watchDate'
        ])

    private toDtos = (watchRecords: WatchRecordDocument[]) =>
        watchRecords.map((watchRecord) => this.toDto(watchRecord))
}
