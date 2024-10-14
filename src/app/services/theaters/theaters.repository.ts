import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Expect, MethodLog, MongooseRepository, PaginationResult } from 'common'
import { differenceWith, escapeRegExp, uniq } from 'lodash'
import { FilterQuery, Model } from 'mongoose'
import { TheaterCreationDto, TheaterQueryDto, TheaterUpdateDto } from './dto'
import { Theater } from './schemas'

@Injectable()
export class TheatersRepository extends MongooseRepository<Theater> {
    constructor(@InjectModel(Theater.name) model: Model<Theater>) {
        super(model)
    }

    async onModuleInit() {
        await this.model.createCollection()
    }

    @MethodLog()
    async createTheater(createDto: TheaterCreationDto) {
        const theater = this.newDocument()
        theater.name = createDto.name
        theater.latlong = createDto.latlong
        theater.seatmap = createDto.seatmap

        return theater.save()
    }

    @MethodLog()
    async updateTheater(theaterId: string, updateDto: TheaterUpdateDto) {
        const theater = await this.getTheater(theaterId)

        if (updateDto.name) theater.name = updateDto.name
        if (updateDto.latlong) theater.latlong = updateDto.latlong
        if (updateDto.seatmap) theater.seatmap = updateDto.seatmap

        return theater.save()
    }

    @MethodLog()
    async deleteTheater(theaterId: string) {
        const theater = await this.getTheater(theaterId)
        await theater.deleteOne()
    }

    @MethodLog({ level: 'verbose' })
    async getTheater(theaterId: string) {
        const theater = await this.findById(theaterId)

        if (!theater) throw new NotFoundException(`Theater with ID ${theaterId} not found`)

        return theater
    }

    @MethodLog({ level: 'verbose' })
    async findTheaters(queryDto: TheaterQueryDto) {
        const { name, ...pagination } = queryDto

        const paginated = await this.findWithPagination((helpers) => {
            const query: FilterQuery<Theater> = {}
            if (name) query.name = new RegExp(escapeRegExp(name), 'i')

            helpers.setQuery(query)
        }, pagination)

        return paginated as PaginationResult<Theater>
    }

    @MethodLog({ level: 'verbose' })
    async getTheatersByIds(theaterIds: string[]) {
        const uniqueIds = uniq(theaterIds)

        Expect.equalLength(
            uniqueIds,
            theaterIds,
            `Duplicate theater IDs are not allowed:${theaterIds}`
        )

        const theaters = await this.findByIds(uniqueIds)
        const notFoundIds = differenceWith(uniqueIds, theaters, (id, theater) => id === theater.id)

        if (notFoundIds.length > 0) {
            throw new NotFoundException(
                `One or more theaters with IDs ${notFoundIds.join(', ')} not found`
            )
        }

        return theaters
    }
}
