import { Injectable } from '@nestjs/common'
import { maps, MethodLog, PaginationResult } from 'common'
import { TheaterCreationDto, TheaterQueryDto, TheaterDto, TheaterUpdateDto } from './dto'
import { TheatersRepository } from './theaters.repository'

@Injectable()
export class TheatersService {
    constructor(private repository: TheatersRepository) {}

    @MethodLog()
    async createTheater(creationDto: TheaterCreationDto) {
        const theater = await this.repository.createTheater(creationDto)
        return new TheaterDto(theater)
    }

    @MethodLog()
    async updateTheater(theaterId: string, updateDto: TheaterUpdateDto) {
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
    async findTheaters(queryDto: TheaterQueryDto) {
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
