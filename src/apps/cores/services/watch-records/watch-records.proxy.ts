import { Injectable } from '@nestjs/common'
import {
    ClientProxyService,
    getProxyValue,
    InjectClientProxy,
    MethodLog,
    PaginationResult
} from 'common'
import { ClientProxyConfig, Messages } from 'shared/config'
import { WatchRecordDto, WatchRecordQueryDto } from './dtos'

@Injectable()
export class WatchRecordsProxy {
    constructor(
        @InjectClientProxy(ClientProxyConfig.connName) private service: ClientProxyService
    ) {}

    @MethodLog({ level: 'verbose' })
    findWatchRecords(queryDto: WatchRecordQueryDto): Promise<PaginationResult<WatchRecordDto>> {
        return getProxyValue(this.service.send(Messages.WatchRecords.findWatchRecords, queryDto))
    }
}
