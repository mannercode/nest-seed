import {
    QueryBuilderOptions,
    assignIfDefined,
    CrudRepository,
    QueryBuilder
} from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { AppConfigService, MONGO_CONNECTION_NAME } from 'config'
import { Model } from 'mongoose'
import { CreateTheaterDto, SearchTheatersPageDto, UpdateTheaterDto } from './dtos'
import { Theater } from './models'

@Injectable()
export class TheatersRepository extends CrudRepository<Theater> {
    constructor(
        @InjectModel(Theater.name, MONGO_CONNECTION_NAME)
        readonly model: Model<Theater>,
        config: AppConfigService
    ) {
        super(model, config.http.paginationDefaultSize)
    }

    async create(createDto: CreateTheaterDto) {
        const theater = this.newDocument()
        theater.name = createDto.name
        theater.location = createDto.location
        theater.seatmap = createDto.seatmap
        await theater.save()

        return theater.toJSON()
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
        // 부분 문자열 검색에 대소문자 구분 없이 매칭한다. API 계약에서 이미
        // 그렇게 약속한 동작이라서, mongo 가 인덱스를 못 타도 그대로 둔다.
        builder.addRegex('name', name)

        const query = builder.build(options)
        return query
    }
}
