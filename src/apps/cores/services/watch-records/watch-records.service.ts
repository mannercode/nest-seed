import { Injectable } from '@nestjs/common'
import { mapDocToDto } from 'common'
import { CreateWatchRecordDto, SearchWatchRecordsPageDto, WatchRecordDto } from './dtos'
import { WatchRecordDocument } from './models'
import { WatchRecordsRepository } from './watch-records.repository'

@Injectable()
export class WatchRecordsService {
    constructor(private readonly repository: WatchRecordsRepository) {}

    async create(createDto: CreateWatchRecordDto) {
        const watchRecord = await this.repository.create(createDto)

        return this.toDto(watchRecord)
    }

    async searchPage(searchDto: SearchWatchRecordsPageDto) {
        const { items, ...pagination } = await this.repository.searchPage(searchDto)

        return { ...pagination, items: this.toDtos(items) }
    }

    private toDto(watchRecord: WatchRecordDocument) {
        return mapDocToDto(watchRecord, WatchRecordDto, [
            'id',
            'customerId',
            'movieId',
            'purchaseId',
            'watchDate'
        ])
    }

    private toDtos(watchRecords: WatchRecordDocument[]) {
        return watchRecords.map((watchRecord) => this.toDto(watchRecord))
    }
}
