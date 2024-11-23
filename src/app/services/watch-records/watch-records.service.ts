import { Injectable } from '@nestjs/common'
import { MethodLog, objectId, toDto, toDtos } from 'common'
import { WatchRecordCreateDto, WatchRecordDto, WatchRecordQueryDto } from './dtos'
import { WatchRecordsRepository } from './watch-records.repository'

@Injectable()
export class WatchRecordsService {
    constructor(private repository: WatchRecordsRepository) {}

    @MethodLog()
    async createWatchRecord(createDto: WatchRecordCreateDto) {
        const payload = {
            ...createDto,
            customerId: objectId(createDto.customerId),
            movieId: objectId(createDto.movieId),
            purchaseId: objectId(createDto.purchaseId)
        }

        const watchRecord = await this.repository.createWatchRecord(payload)

        return toDto(watchRecord, WatchRecordDto)
    }

    @MethodLog({ level: 'verbose' })
    async findWatchRecords(queryDto: WatchRecordQueryDto) {
        const { items, ...paginated } = await this.repository.findWatchRecords(queryDto)

        return { ...paginated, items: toDtos(items, WatchRecordDto) }
    }
}
