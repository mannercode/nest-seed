import { mapDocToDto } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { CreateWatchRecordDto, SearchWatchRecordsPageDto, WatchRecordSchema } from './dtos/index.js'
import { WatchRecord } from './models/index.js'
import { WatchRecordsRepository } from './watch-records.repository.js'

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
        return mapDocToDto(watchRecord, WatchRecordSchema)
    }

    private toDtos(watchRecords: WatchRecord[]) {
        return watchRecords.map((watchRecord) => this.toDto(watchRecord))
    }
}
