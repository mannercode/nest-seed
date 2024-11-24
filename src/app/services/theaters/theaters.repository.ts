import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { addRegexQuery, MethodLog, MongooseRepository, ObjectId } from 'common'
import { FilterQuery, Model } from 'mongoose'
import { TheaterQueryDto } from './dtos'
import { Theater, TheaterCreatePayload, TheaterUpdatePayload } from './models'

@Injectable()
export class TheatersRepository extends MongooseRepository<Theater> {
    constructor(@InjectModel(Theater.name) model: Model<Theater>) {
        super(model)
    }

    @MethodLog()
    async createTheater(payload: TheaterCreatePayload) {
        const theater = this.newDocument()
        Object.assign(theater, payload)

        return theater.save()
    }

    @MethodLog()
    async updateTheater(theaterId: ObjectId, payload: TheaterUpdatePayload) {
        const theater = await this.getById(theaterId)

        if (payload.name) theater.name = payload.name
        if (payload.latlong) theater.latlong = payload.latlong
        if (payload.seatmap) theater.seatmap = payload.seatmap

        return theater.save()
    }

    @MethodLog({ level: 'verbose' })
    async findTheaters(queryDto: TheaterQueryDto) {
        const { name, ...pagination } = queryDto

        const paginated = await this.findWithPagination((helpers) => {
            const query: FilterQuery<Theater> = {}
            addRegexQuery(query, 'name', name)

            helpers.setQuery(query)
        }, pagination)

        return paginated
    }
}
