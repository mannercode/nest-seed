import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { addRegexQuery, MethodLog, MongooseRepository } from 'common'
import { MongooseConfig } from 'config'
import { FilterQuery, Model } from 'mongoose'
import { TheaterCreateDto, TheaterQueryDto, TheaterUpdateDto } from './dtos'
import { Theater } from './models'

@Injectable()
export class TheatersRepository extends MongooseRepository<Theater> {
    constructor(@InjectModel(Theater.name, MongooseConfig.connName) model: Model<Theater>) {
        super(model)
    }

    @MethodLog()
    async createTheater(createDto: TheaterCreateDto) {
        const theater = this.newDocument()
        theater.name = createDto.name
        theater.latlong = createDto.latlong
        theater.seatmap = createDto.seatmap

        return theater.save()
    }

    @MethodLog()
    async updateTheater(theaterId: string, updateDto: TheaterUpdateDto) {
        const theater = await this.getById(theaterId)

        if (updateDto.name) theater.name = updateDto.name
        if (updateDto.latlong) theater.latlong = updateDto.latlong
        if (updateDto.seatmap) theater.seatmap = updateDto.seatmap

        return theater.save()
    }

    @MethodLog({ level: 'verbose' })
    async findTheaters(queryDto: TheaterQueryDto) {
        const { name, ...pagination } = queryDto

        const paginated = await this.findWithPagination({
            callback: (helpers) => {
                const query: FilterQuery<Theater> = {}
                addRegexQuery(query, 'name', name)

                helpers.setQuery(query)
            },
            pagination
        })

        return paginated
    }
}
