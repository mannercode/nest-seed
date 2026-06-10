import { QueryBuilderOptions, CrudRepository, QueryBuilder } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { AppConfigService, MONGO_CONNECTION_NAME } from 'config'
import { Model } from 'mongoose'
import { CreateWatchRecordDto, SearchWatchRecordsPageDto } from './dtos'
import { WatchRecord } from './models'

@Injectable()
export class WatchRecordsRepository extends CrudRepository<WatchRecord> {
    constructor(
        @InjectModel(WatchRecord.name, MONGO_CONNECTION_NAME)
        readonly model: Model<WatchRecord>,
        config: AppConfigService
    ) {
        super(model, config.http.paginationDefaultSize, config.http.paginationMaxSize)
    }

    async create(createDto: CreateWatchRecordDto) {
        const watchRecord = this.newDocument()
        watchRecord.userId = createDto.userId
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
        const { userId } = searchDto

        const builder = new QueryBuilder<WatchRecord>()
        builder.addEquals('userId', userId)

        const query = builder.build(options)
        return query
    }
}
