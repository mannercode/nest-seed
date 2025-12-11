import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Messages } from 'shared'
import { CreateWatchRecordDto, SearchWatchRecordsPageDto } from './dtos'
import { WatchRecordsService } from './watch-records.service'

@Controller()
export class WatchRecordsController {
    constructor(private readonly service: WatchRecordsService) {}

    @MessagePattern(Messages.WatchRecords.create)
    create(@Payload() createDto: CreateWatchRecordDto) {
        return this.service.create(createDto)
    }

    @MessagePattern(Messages.WatchRecords.searchPage)
    searchPage(@Payload() searchDto: SearchWatchRecordsPageDto) {
        return this.service.searchPage(searchDto)
    }
}
