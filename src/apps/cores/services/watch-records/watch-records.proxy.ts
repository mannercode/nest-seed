import { Injectable } from '@nestjs/common'
import {
    ClientProxyService,
    getProxyValue,
    InjectClientProxy,
    MethodLog,
    PaginationResult
} from 'common'
import { WatchRecordCreateDto, WatchRecordDto, WatchRecordQueryDto } from './dtos'

@Injectable()
export class WatchRecordsProxy {
    constructor(@InjectClientProxy('CORES_CLIENT') private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    createWatchRecord(createDto: WatchRecordCreateDto): Promise<WatchRecordDto> {
        return getProxyValue(this.service.send('createWatchRecord', createDto))
    }

    @MethodLog({ level: 'verbose' })
    findWatchRecords(queryDto: WatchRecordQueryDto): Promise<PaginationResult<WatchRecordDto>> {
        return getProxyValue(this.service.send('findWatchRecords', queryDto))
    }
}
