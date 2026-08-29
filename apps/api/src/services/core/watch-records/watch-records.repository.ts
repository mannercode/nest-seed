import { QueryBuilderOptions, CrudRepository, QueryBuilder } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { AppConfigService, MongoConnection } from '#config'
import { CreateWatchRecordDto, SearchWatchRecordsPageDto } from './dtos/index.js'
import { WatchRecord } from './models/index.js'

@Injectable()
export class WatchRecordsRepository extends CrudRepository<WatchRecord> {
    constructor(connection: MongoConnection, config: AppConfigService) {
        super(
            connection.db.collection('watchrecords'),
            connection.client,
            config.http.paginationDefaultSize,
            config.http.paginationMaxSize
        )
    }

    async create(createDto: CreateWatchRecordDto) {
        const watchRecord = this.newDocument()
        watchRecord.userId = createDto.userId
        watchRecord.movieId = createDto.movieId
        watchRecord.purchaseRecordId = createDto.purchaseRecordId
        watchRecord.watchDate = createDto.watchDate

        return this.insertOne(watchRecord)
    }

    async searchPage(searchDto: SearchWatchRecordsPageDto) {
        const { orderby, page, size } = searchDto

        const pagination = await this.findWithPagination({
            filter: this.buildQuery(searchDto, { allowEmpty: true }),
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
