import { Injectable } from '@nestjs/common'
import { maps, MethodLog, objectId, PaginationResult } from 'common'
import { WatchRecordCreateDto, WatchRecordDto, WatchRecordQueryDto } from './dtos'
import { WatchRecordsRepository } from './watch-records.repository'

@Injectable()
export class WatchRecordsService {
    constructor(private repository: WatchRecordsRepository) {}

    @MethodLog()
    async createWatchRecords(createDto: WatchRecordCreateDto) {
        const payloads = {
            ...createDto,
            customerId: objectId(createDto.customerId),
            movieId: objectId(createDto.movieId),
            purchaseId: objectId(createDto.purchaseId)
        }

        const watchRecord = await this.repository.createWatchRecords(payloads)

        return new WatchRecordDto(watchRecord)
    }

    @MethodLog({ level: 'verbose' })
    async findWatchRecords(queryDto: WatchRecordQueryDto) {
        const { items, ...paginated } = await this.repository.findWatchRecords(queryDto)

        return {
            ...paginated,
            items: maps(items, WatchRecordDto)
        } as PaginationResult<WatchRecordDto>
    }
}
