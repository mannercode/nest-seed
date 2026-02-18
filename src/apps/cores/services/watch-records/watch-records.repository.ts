import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { QueryBuilderOptions } from 'common'
import { MongooseRepository, QueryBuilder } from 'common'
import { Model } from 'mongoose'
import { MongooseConfigModule } from 'shared'
import { CreateWatchRecordDto, SearchWatchRecordsPageDto } from './dtos'
import { WatchRecord } from './models'

@Injectable()
export class WatchRecordsRepository extends MongooseRepository<WatchRecord> {
    constructor(
        @InjectModel(WatchRecord.name, MongooseConfigModule.connectionName)
        readonly model: Model<WatchRecord>
    ) {
        super(model, MongooseConfigModule.maxTake)
    }

    async create(createDto: CreateWatchRecordDto) {
        const watchRecord = this.newDocument()
        watchRecord.customerId = createDto.customerId
        watchRecord.movieId = createDto.movieId
        watchRecord.purchaseRecordId = createDto.purchaseRecordId
        watchRecord.watchDate = createDto.watchDate

        await watchRecord.save()

        return watchRecord.toJSON()
    }

    async searchPage(searchDto: SearchWatchRecordsPageDto) {
        const { orderby, skip, take } = searchDto

        const pagination = await this.findWithPagination({
            configureQuery: async (queryHelper) => {
                const query = this.buildQuery(searchDto, { allowEmpty: true })

                queryHelper.setQuery(query)
            },
            pagination: { orderby, skip, take }
        })

        return pagination
    }

    private buildQuery(searchDto: SearchWatchRecordsPageDto, options: QueryBuilderOptions) {
        const { customerId } = searchDto

        const builder = new QueryBuilder<WatchRecord>()
        builder.addEqual('customerId', customerId)

        const query = builder.build(options)
        return query
    }
}
