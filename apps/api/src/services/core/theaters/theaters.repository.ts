import {
    QueryBuilderOptions,
    assignIfDefined,
    CrudRepository,
    objectIds,
    QueryBuilder,
    uniq
} from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { AppConfigService, MONGO_CONNECTION_NAME } from 'config'
import { ClientSession, Model } from 'mongoose'
import { CreateTheaterDto, SearchTheatersPageDto, UpdateTheaterDto } from './dtos'
import { Theater } from './models'

@Injectable()
export class TheatersRepository extends CrudRepository<Theater> {
    constructor(
        @InjectModel(Theater.name, MONGO_CONNECTION_NAME)
        readonly model: Model<Theater>,
        config: AppConfigService
    ) {
        super(model, config.http.paginationDefaultSize, config.http.paginationMaxSize)
    }

    async create(createDto: CreateTheaterDto) {
        const theater = this.newDocument()
        theater.name = createDto.name
        theater.location = createDto.location
        theater.seatmap = createDto.seatmap
        await theater.save()

        return theater.toJSON()
    }

    async acquireShowtimeScheduleGuards(
        theaterIds: string[],
        session: ClientSession,
        signal: AbortSignal | undefined = undefined
    ) {
        // 실제 Theater 문서를 쓰기 충돌 지점으로 사용한다. 같은 극장을 포함하는 두 트랜잭션은
        // 이 갱신에서 직렬화되고, 드라이버는 TransientTransactionError를 새 snapshot으로 재시도한다.
        const ids = objectIds(uniq(theaterIds))
        const options = { session, signal }
        const result = await this.model.updateMany(
            { _id: { $in: ids } },
            { $inc: { showtimeScheduleVersion: 1 } },
            options
        )

        return result.matchedCount === ids.length
    }

    async searchPage(searchDto: SearchTheatersPageDto) {
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

    async update(theaterId: string, updateDto: UpdateTheaterDto) {
        const theater = await this.getDocumentById(theaterId)
        assignIfDefined(theater, updateDto, 'name')
        assignIfDefined(theater, updateDto, 'location')
        assignIfDefined(theater, updateDto, 'seatmap')
        await theater.save()

        return theater.toJSON()
    }

    private buildQuery(searchDto: SearchTheatersPageDto, options: QueryBuilderOptions) {
        const { name } = searchDto

        const builder = new QueryBuilder<Theater>()
        builder.addRegex('name', name)

        const query = builder.build(options)
        return query
    }
}
