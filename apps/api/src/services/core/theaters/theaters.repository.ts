import type { ClientSession } from 'mongodb'
import {
    QueryBuilderOptions,
    assignIfDefined,
    CrudRepository,
    mongoToPublic,
    MongoErrors,
    objectId,
    objectIds,
    QueryBuilder,
    uniq
} from '@mannercode/common'
import { Injectable, NotFoundException } from '@nestjs/common'
import { AppConfigService, MongoConnection } from '#config'
import {
    CreateTheaterSchema,
    type CreateTheaterDto,
    type SearchTheatersPageDto,
    type UpdateTheaterDto
} from './dtos/index.js'
import { Theater } from './models/index.js'

const TheaterPatchSchema = CreateTheaterSchema.partial()

@Injectable()
export class TheatersRepository extends CrudRepository<Theater> {
    constructor(connection: MongoConnection, config: AppConfigService) {
        super(
            connection.db.collection('theaters'),
            connection.client,
            config.http.paginationDefaultSize,
            config.http.paginationMaxSize,
            { projection: { showtimeScheduleVersion: 0 } }
        )
    }

    async create(createDto: CreateTheaterDto) {
        CreateTheaterSchema.parse(createDto)
        const theater = this.newDocument()
        theater.name = createDto.name
        theater.location = createDto.location
        theater.seatmap = createDto.seatmap
        theater.showtimeScheduleVersion = 0

        return this.insertOne(theater)
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
        const result = await this.collection.updateMany(
            this.activeFilter({ _id: { $in: ids } }),
            this.timestamped({ $inc: { showtimeScheduleVersion: 1 } }),
            options
        )

        return result.matchedCount === ids.length
    }

    async searchPage(searchDto: SearchTheatersPageDto) {
        const { orderby, page, size } = searchDto

        const pagination = await this.findWithPagination({
            filter: this.buildQuery(searchDto, { allowEmpty: true }),
            pagination: {
                orderby: orderby ?? undefined,
                page: page ?? undefined,
                size: size ?? undefined
            }
        })

        return pagination
    }

    async update(theaterId: string, updateDto: UpdateTheaterDto) {
        TheaterPatchSchema.parse(updateDto)
        const fields: Partial<Pick<Theater, 'location' | 'name' | 'seatmap'>> = {}
        assignIfDefined(fields, updateDto, 'name')
        assignIfDefined(fields, updateDto, 'location')
        assignIfDefined(fields, updateDto, 'seatmap')
        const theater = await this.collection.findOneAndUpdate(
            this.activeFilter({ _id: objectId(theaterId) }),
            this.timestamped({ $set: fields }),
            { projection: this.projection, returnDocument: 'after' }
        )

        if (!theater) throw new NotFoundException(MongoErrors.DocumentNotFound(theaterId))
        return mongoToPublic<Theater>(theater)
    }

    private buildQuery(searchDto: SearchTheatersPageDto, options: QueryBuilderOptions) {
        const { name } = searchDto

        const builder = new QueryBuilder<Theater>()
        builder.addRegex('name', name ?? undefined)

        const query = builder.build(options)
        return query
    }
}
