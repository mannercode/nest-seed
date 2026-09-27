import {
    type TransactionContext,
    QueryBuilderOptions,
    assignIfDefined,
    CrudRepository,
    MongoErrors,
    QueryBuilder,
    uniq,
    MongoConnection
} from '@mannercode/common'
import { Injectable, NotFoundException } from '@nestjs/common'
import { AppConfigService } from '#config'
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
            connection,
            'theaters',
            config.http.paginationDefaultSize,
            config.http.paginationMaxSize
        )
    }

    async create(createDto: CreateTheaterDto) {
        CreateTheaterSchema.parse(createDto)
        const theater = this.newDocument()
        theater.name = createDto.name
        theater.location = createDto.location
        theater.seatmap = createDto.seatmap

        return this.insertOne(theater)
    }

    async acquireShowtimeScheduleGuards(
        theaterIds: string[],
        transaction: TransactionContext,
        signal: AbortSignal | undefined = undefined
    ) {
        // 같은 극장을 갱신하는 동시 트랜잭션 중 하나가 쓰기 충돌로 실패하도록 Theater 문서를 갱신한다.
        // 드라이버는 TransientTransactionError를 받으면 새 snapshot으로 트랜잭션을 재시도한다.
        const ids = uniq(theaterIds)
        const options = { transaction, signal }
        const result = await this.updateDocuments(
            this.activeFilter(this.idsFilter(ids)),
            this.timestamped({}),
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
        const theater = await this.findAndUpdateDocument(
            this.activeFilter(this.idFilter(theaterId)),
            this.timestamped({ $set: fields }),
            { projection: this.projection, returnDocument: 'after' }
        )

        if (!theater) throw new NotFoundException(MongoErrors.DocumentNotFound(theaterId))
        return theater
    }

    private buildQuery(searchDto: SearchTheatersPageDto, options: QueryBuilderOptions) {
        const { name } = searchDto

        const builder = new QueryBuilder()
        builder.addRegex('name', name ?? undefined)

        const query = builder.build(options)
        return query
    }
}
