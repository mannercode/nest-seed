import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { addIdQuery, MethodLog, MongooseRepository } from 'common'
import { FilterQuery, Model } from 'mongoose'
import { WatchRecordQueryDto } from './dtos'
import { WatchRecord, WatchRecordCreatePayload } from './models'

@Injectable()
export class WatchRecordsRepository extends MongooseRepository<WatchRecord> {
    constructor(@InjectModel(WatchRecord.name) model: Model<WatchRecord>) {
        super(model)
    }

    @MethodLog()
    async createWatchRecords(payload: WatchRecordCreatePayload) {
        const watchRecord = this.newDocument()
        Object.assign(watchRecord, payload)

        return watchRecord.save()
    }

    @MethodLog({ level: 'verbose' })
    async findWatchRecords(queryDto: WatchRecordQueryDto) {
        const { customerId, ...pagination } = queryDto

        const paginated = await this.findWithPagination((helpers) => {
            const query: FilterQuery<WatchRecord> = {}
            addIdQuery(query, 'customerId', customerId)

            helpers.setQuery(query)
        }, pagination)

        return paginated
    }
}
