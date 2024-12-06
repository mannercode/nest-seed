import { Injectable } from '@nestjs/common'
import { mapDocToDto, MethodLog } from 'common'
import { TheaterCreateDto, TheaterDto, TheaterQueryDto, TheaterUpdateDto } from './dtos'
import { TheaterDocument } from './models'
import { TheatersRepository } from './theaters.repository'

@Injectable()
export class TheatersService {
    constructor(private repository: TheatersRepository) {}

    @MethodLog()
    async createTheater(createDto: TheaterCreateDto) {
        const theater = await this.repository.createTheater(createDto)
        return this.toDto(theater)
    }

    @MethodLog()
    async updateTheater(theaterId: string, updateDto: TheaterUpdateDto) {
        const theater = await this.repository.updateTheater(theaterId, updateDto)
        return this.toDto(theater)
    }

    @MethodLog({ level: 'verbose' })
    async getTheater(theaterId: string) {
        const theater = await this.repository.getById(theaterId)
        return this.toDto(theater)
    }

    @MethodLog()
    async deleteTheater(theaterId: string) {
        await this.repository.deleteById(theaterId)
        return true
    }

    @MethodLog({ level: 'verbose' })
    async findTheaters(queryDto: TheaterQueryDto) {
        const { items, ...paginated } = await this.repository.findTheaters(queryDto)

        return {
            ...paginated,
            items: this.toDtos(items)
        }
    }

    @MethodLog({ level: 'verbose' })
    async getTheatersByIds(theaterIds: string[]) {
        const theaters = await this.repository.getByIds(theaterIds)

        return this.toDtos(theaters)
    }

    @MethodLog({ level: 'verbose' })
    async theatersExist(theaterIds: string[]) {
        return this.repository.existByIds(theaterIds)
    }

    private toDto = (theater: TheaterDocument) =>
        mapDocToDto(theater, TheaterDto, ['id', 'name', 'latlong', 'seatmap'])

    private toDtos = (theaters: TheaterDocument[]) => theaters.map((theater) => this.toDto(theater))
}
