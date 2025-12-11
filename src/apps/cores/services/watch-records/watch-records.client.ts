import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy, PaginationResult } from 'common'
import { Messages } from 'shared'
import { CreateWatchRecordDto, SearchWatchRecordsPageDto, WatchRecordDto } from './dtos'

@Injectable()
export class WatchRecordsClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    create(createDto: CreateWatchRecordDto): Promise<WatchRecordDto> {
        return this.proxy.getJson(Messages.WatchRecords.create, createDto)
    }

    searchPage(searchDto: SearchWatchRecordsPageDto): Promise<PaginationResult<WatchRecordDto>> {
        return this.proxy.getJson(Messages.WatchRecords.searchPage, searchDto)
    }
}
