import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { addIdQuery, MethodLog, MongooseRepository, objectId } from 'common'
import { MongooseConfig } from 'config'
import { FilterQuery, Model } from 'mongoose'
import { WatchRecordCreateDto, WatchRecordQueryDto } from './dtos'
import { WatchRecord } from './models'

@Injectable()
export class WatchRecordsRepository extends MongooseRepository<WatchRecord> {
    constructor(@InjectModel(WatchRecord.name, MongooseConfig.connName) model: Model<WatchRecord>) {
        super(model)
    }

    @MethodLog()
    async createWatchRecord(createDto: WatchRecordCreateDto) {
        const watchRecord = this.newDocument()
        watchRecord.customerId = objectId(createDto.customerId)
        watchRecord.movieId = objectId(createDto.movieId)
        watchRecord.purchaseId = objectId(createDto.purchaseId)
        watchRecord.watchDate = createDto.watchDate

        return watchRecord.save()
    }

    @MethodLog({ level: 'verbose' })
    async findWatchRecords(queryDto: WatchRecordQueryDto) {
        const { customerId, ...pagination } = queryDto

        const paginated = await this.findWithPagination({
            callback: (helpers) => {
                const query: FilterQuery<WatchRecord> = {}
                addIdQuery(query, 'customerId', customerId)

                helpers.setQuery(query)
            },
            pagination
        })

        return paginated
    }
}
