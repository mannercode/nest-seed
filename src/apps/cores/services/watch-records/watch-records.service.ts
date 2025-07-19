import { Injectable } from '@nestjs/common'
import { mapDocToDto } from 'common'
import { CreateWatchRecordDto, SearchWatchRecordsPageDto, WatchRecordDto } from './dtos'
import { WatchRecordDocument } from './models'
import { WatchRecordsRepository } from './watch-records.repository'

@Injectable()
export class WatchRecordsService {
    constructor(private repository: WatchRecordsRepository) {}

    async createWatchRecord(createDto: CreateWatchRecordDto) {
        const watchRecord = await this.repository.createWatchRecord(createDto)

        return this.toDto(watchRecord)
    }

    async searchWatchRecordsPage(searchDto: SearchWatchRecordsPageDto) {
        const { items, ...pagination } = await this.repository.searchWatchRecordsPage(searchDto)

        return { ...pagination, items: this.toDtos(items) }
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
