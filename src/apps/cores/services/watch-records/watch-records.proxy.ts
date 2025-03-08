import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy, MethodLog, PaginationResult } from 'common'
import { ClientProxyConfig, Messages } from 'shared/config'
import { WatchRecordDto, WatchRecordQueryDto } from './dtos'

@Injectable()
export class WatchRecordsProxy {
    constructor(
        @InjectClientProxy(ClientProxyConfig.connName) private service: ClientProxyService
    ) {}

    @MethodLog({ level: 'verbose' })
    findWatchRecords(queryDto: WatchRecordQueryDto): Promise<PaginationResult<WatchRecordDto>> {
        return this.service.getJson(Messages.WatchRecords.findWatchRecords, queryDto)
    }
}
