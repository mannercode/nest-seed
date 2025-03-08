import { Injectable } from '@nestjs/common'
import { mapDocToDto } from 'common'
import { TheaterCreateDto, TheaterDto, TheaterQueryDto, TheaterUpdateDto } from './dtos'
import { TheaterDocument } from './models'
import { TheatersRepository } from './theaters.repository'

@Injectable()
export class TheatersService {
    constructor(private repository: TheatersRepository) {}

    async createTheater(createDto: TheaterCreateDto) {
        const theater = await this.repository.createTheater(createDto)
        return this.toDto(theater)
    }

    async updateTheater(theaterId: string, updateDto: TheaterUpdateDto) {
        const theater = await this.repository.updateTheater(theaterId, updateDto)
        return this.toDto(theater)
    }

    async getTheater(theaterId: string) {
        const theater = await this.repository.getById(theaterId)
        return this.toDto(theater)
    }

    async deleteTheater(theaterId: string) {
        await this.repository.deleteById(theaterId)
        return true
    }

    async findTheaters(queryDto: TheaterQueryDto) {
        const { items, ...paginated } = await this.repository.findTheaters(queryDto)

        return {
            ...paginated,
            items: this.toDtos(items)
        }
    }

    async getTheatersByIds(theaterIds: string[]) {
        const theaters = await this.repository.getByIds(theaterIds)

        return this.toDtos(theaters)
    }

    async theatersExist(theaterIds: string[]) {
        return this.repository.existByIds(theaterIds)
    }

    private toDto = (theater: TheaterDocument) =>
        mapDocToDto(theater, TheaterDto, ['id', 'name', 'latlong', 'seatmap'])

    private toDtos = (theaters: TheaterDocument[]) => theaters.map((theater) => this.toDto(theater))
}
