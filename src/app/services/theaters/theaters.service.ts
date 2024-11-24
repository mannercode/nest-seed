import { Injectable } from '@nestjs/common'
import { MethodLog, objectId, objectIds, toDto, toDtos } from 'common'
import { TheaterCreateDto, TheaterDto, TheaterQueryDto, TheaterUpdateDto } from './dtos'
import { TheatersRepository } from './theaters.repository'

@Injectable()
export class TheatersService {
    constructor(private repository: TheatersRepository) {}

    @MethodLog()
    async createTheater(createDto: TheaterCreateDto) {
        const theater = await this.repository.createTheater(createDto)
        return new TheaterDto(theater.toJSON())
    }

    @MethodLog()
    async updateTheater(theaterId: string, updateDto: TheaterUpdateDto) {
        const theater = await this.repository.updateTheater(objectId(theaterId), updateDto)
        return toDto(theater, TheaterDto)
    }

    @MethodLog({ level: 'verbose' })
    async getTheater(theaterId: string) {
        const theater = await this.repository.getById(objectId(theaterId))
        return toDto(theater, TheaterDto)
    }

    @MethodLog()
    async deleteTheater(theaterId: string) {
        await this.repository.deleteById(objectId(theaterId))
        return true
    }

    @MethodLog({ level: 'verbose' })
    async findTheaters(queryDto: TheaterQueryDto) {
        const { items, ...paginated } = await this.repository.findTheaters(queryDto)

        return {
            ...paginated,
            items: toDtos(items, TheaterDto)
        }
    }

    @MethodLog({ level: 'verbose' })
    async getTheatersByIds(theaterIds: string[]) {
        const theaters = await this.repository.getByIds(objectIds(theaterIds))

        return toDtos(theaters, TheaterDto)
    }

    @MethodLog({ level: 'verbose' })
    async theatersExist(theaterIds: string[]): Promise<boolean> {
        return this.repository.existsByIds(objectIds(theaterIds))
    }
}
