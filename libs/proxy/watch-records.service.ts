import { Injectable } from '@nestjs/common'
import { ClientProxyService, MethodLog } from 'common'
import { Observable } from 'rxjs'
import { WatchRecordCreateDto, WatchRecordDto, WatchRecordQueryDto } from 'types'

@Injectable()
export class WatchRecordsService {
    constructor(private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    createWatchRecord(createDto: WatchRecordCreateDto): Observable<WatchRecordDto> {
        return this.service.send('createWatchRecord', createDto)
    }

    @MethodLog({ level: 'verbose' })
    findWatchRecords(queryDto: WatchRecordQueryDto): Observable<WatchRecordDto[]> {
        return this.service.send('findWatchRecords', queryDto)
    }
}
