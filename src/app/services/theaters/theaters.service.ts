import { Injectable } from '@nestjs/common'
import { maps, MethodLog, PaginationResult } from 'common'
import { CreateTheaterDto, QueryTheatersDto, TheaterDto, UpdateTheaterDto } from './dto'
import { TheatersRepository } from './theaters.repository'

@Injectable()
export class TheatersService {
    constructor(private repository: TheatersRepository) {}

    @MethodLog()
    async createTheater(createDto: CreateTheaterDto) {
        const theater = await this.repository.createTheater(createDto)
        return new TheaterDto(theater)
    }

    @MethodLog()
    async updateTheater(theaterId: string, updateDto: UpdateTheaterDto) {
        const theater = await this.repository.updateTheater(theaterId, updateDto)
        return new TheaterDto(theater)
    }

    @MethodLog({ level: 'verbose' })
    async getTheater(theaterId: string) {
        const theater = await this.repository.getTheater(theaterId)
        return new TheaterDto(theater)
    }

    @MethodLog()
    async deleteTheater(theaterId: string) {
        await this.repository.deleteTheater(theaterId)
        return true
    }

    @MethodLog({ level: 'verbose' })
    async findTheaters(queryDto: QueryTheatersDto) {
        const { items, ...paginated } = await this.repository.findTheaters(queryDto)

        return { ...paginated, items: maps(items, TheaterDto) } as PaginationResult<TheaterDto>
    }

    @MethodLog({ level: 'verbose' })
    async getTheatersByIds(theaterIds: string[]) {
        const theaters = await this.repository.getTheatersByIds(theaterIds)
        return maps(theaters, TheaterDto)
    }

    // @MethodLog({ level: 'verbose' })
    // async theatersExist(theaterIds: string[]): Promise<boolean> {
    //     return this.repository.existsByIds(theaterIds)
    // }
}
