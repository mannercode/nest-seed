import { Injectable } from '@nestjs/common'
import { ClientProxyService, getProxyValue, MethodLog } from 'common'
import { WatchRecordCreateDto, WatchRecordDto, WatchRecordQueryDto } from 'types'

@Injectable()
export class WatchRecordsService {
    constructor(private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    createWatchRecord(createDto: WatchRecordCreateDto): Promise<WatchRecordDto> {
        return getProxyValue(this.service.send('createWatchRecord', createDto))
    }

    @MethodLog({ level: 'verbose' })
    findWatchRecords(queryDto: WatchRecordQueryDto): Promise<WatchRecordDto[]> {
        return getProxyValue(this.service.send('findWatchRecords', queryDto))
    }
}
