import { Injectable } from '@nestjs/common'
import { mapDocToDto } from 'common'
import type { CreateWatchRecordDto, SearchWatchRecordsPageDto } from './dtos'
import type { WatchRecord } from './models'
import type { WatchRecordsRepository } from './watch-records.repository'
import { WatchRecordDto } from './dtos'

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

    private toDto(watchRecord: WatchRecord) {
        return this.toDtos([watchRecord])[0]
    }

    private toDtos(watchRecords: WatchRecord[]) {
        return watchRecords.map((watchRecord) =>
            mapDocToDto(watchRecord, WatchRecordDto, [
                'id',
                'customerId',
                'movieId',
                'purchaseRecordId',
                'watchDate'
            ])
        )
    }
}
