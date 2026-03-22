import { PaginationResult } from '@mannercode/nest-common'
import { ClientProxyService } from '@mannercode/nest-microservice'
import { InjectClientProxy } from '@mannercode/nest-microservice'
import { Injectable } from '@nestjs/common'
import { Messages } from 'common'
import { CreateWatchRecordDto, SearchWatchRecordsPageDto, WatchRecordDto } from './dtos'

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
