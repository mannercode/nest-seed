import type { QueryBuilderOptions } from 'common'
import type { Model } from 'mongoose'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { assignDefined, MongooseRepository, QueryBuilder } from 'common'
import { MongooseConfigModule } from 'shared'
import type { CreateTheaterDto, SearchTheatersPageDto, UpdateTheaterDto } from './dtos'
import { Theater } from './models'

@Injectable()
export class TheatersRepository extends MongooseRepository<Theater> {
    constructor(
        @InjectModel(Theater.name, MongooseConfigModule.connectionName)
        readonly model: Model<Theater>
    ) {
        super(model, MongooseConfigModule.maxTake)
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

    async update(theaterId: string, updateDto: UpdateTheaterDto) {
        const theater = await this.getDocumentById(theaterId)
        assignDefined(theater, updateDto, 'name')
        assignDefined(theater, updateDto, 'location')
        assignDefined(theater, updateDto, 'seatmap')
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
