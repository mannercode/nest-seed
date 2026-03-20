import { QueryBuilderOptions } from '@mannercode/nest-common'
import { MongooseRepository, QueryBuilder } from '@mannercode/nest-common'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { MongooseConfigModule } from 'app-common'
import { Model } from 'mongoose'
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
        const { orderby, page, size } = searchDto

        const pagination = await this.findWithPagination({
            configureQuery: async (queryHelper) => {
                const query = this.buildQuery(searchDto, { allowEmpty: true })

                queryHelper.setQuery(query)
            },
            pagination: { orderby, page, size }
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
