import type { ClientProxyService, PaginationResult } from 'common'
import { Injectable } from '@nestjs/common'
import { InjectClientProxy } from 'common'
import { Messages } from 'shared'
import type { CreateWatchRecordDto, SearchWatchRecordsPageDto, WatchRecordDto } from './dtos'

@Injectable()
export class WatchRecordsClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    create(createDto: CreateWatchRecordDto): Promise<WatchRecordDto> {
        return this.proxy.request(Messages.WatchRecords.create, createDto)
    }

    searchPage(searchDto: SearchWatchRecordsPageDto): Promise<PaginationResult<WatchRecordDto>> {
        return this.proxy.request(Messages.WatchRecords.searchPage, searchDto)
    }
}
