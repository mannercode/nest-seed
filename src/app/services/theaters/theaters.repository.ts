import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import {
    addRegexQuery,
    Expect,
    MethodLog,
    MongooseRepository,
    ObjectId,
    PaginationResult
} from 'common'
import { differenceWith, uniq } from 'lodash'
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
        const theater = await this.getTheater(theaterId)

        if (payload.name) theater.name = payload.name
        if (payload.latlong) theater.latlong = payload.latlong
        if (payload.seatmap) theater.seatmap = payload.seatmap

        return theater.save()
    }

    @MethodLog()
    async deleteTheater(theaterId: ObjectId) {
        const theater = await this.getTheater(theaterId)
        await theater.deleteOne()
    }

    @MethodLog({ level: 'verbose' })
    async getTheater(theaterId: ObjectId) {
        const theater = await this.findById(theaterId)

        if (!theater) throw new NotFoundException(`Theater with ID ${theaterId} not found`)

        return theater
    }

    @MethodLog({ level: 'verbose' })
    async findTheaters(queryDto: TheaterQueryDto) {
        const { name, ...pagination } = queryDto

        const paginated = await this.findWithPagination((helpers) => {
            const query: FilterQuery<Theater> = {}
            addRegexQuery(query, 'name', name)

            helpers.setQuery(query)
        }, pagination)

        return paginated as PaginationResult<Theater>
    }

    @MethodLog({ level: 'verbose' })
    async getTheatersByIds(theaterIds: ObjectId[]) {
        const uniqueIds = uniq(theaterIds)

        Expect.equalLength(
            uniqueIds,
            theaterIds,
            `Duplicate theater IDs are not allowed:${theaterIds}`
        )

        const theaters = await this.findByIds(uniqueIds)
        const notFoundIds = differenceWith(uniqueIds, theaters, (id, theater) =>
            id.equals(theater._id)
        )

        if (notFoundIds.length > 0) {
            throw new NotFoundException(
                `One or more theaters with IDs ${notFoundIds.join(', ')} not found`
            )
        }

        return theaters
    }
}
