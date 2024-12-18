import { Injectable } from '@nestjs/common'
import { ClientProxyService, getProxyValue, InjectClientProxy, MethodLog } from 'common'
import { WatchRecordCreateDto, WatchRecordDto, WatchRecordQueryDto } from 'types'

@Injectable()
export class WatchRecordsService {
    constructor(@InjectClientProxy('SERVICES_CLIENT') private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    createWatchRecord(createDto: WatchRecordCreateDto): Promise<WatchRecordDto> {
        return getProxyValue(this.service.send('createWatchRecord', createDto))
    }

    @MethodLog({ level: 'verbose' })
    findWatchRecords(queryDto: WatchRecordQueryDto): Promise<WatchRecordDto[]> {
        return getProxyValue(this.service.send('findWatchRecords', queryDto))
    }
}
