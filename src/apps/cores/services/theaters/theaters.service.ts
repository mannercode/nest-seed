import { Injectable } from '@nestjs/common'
import { mapDocToDto } from 'common'
import { CreateTheaterDto, SearchTheatersPageDto, TheaterDto, UpdateTheaterDto } from './dtos'
import { TheaterDocument } from './models'
import { TheatersRepository } from './theaters.repository'

@Injectable()
export class TheatersService {
    constructor(private repository: TheatersRepository) {}

    async create(createDto: CreateTheaterDto) {
        const theater = await this.repository.create(createDto)

        return this.toDto(theater)
    }

    async update(theaterId: string, updateDto: UpdateTheaterDto) {
        const theater = await this.repository.update(theaterId, updateDto)

        return this.toDto(theater)
    }

    async getMany(theaterIds: string[]) {
        const theaters = await this.repository.getByIds(theaterIds)

        return this.toDtos(theaters)
    }

    async deleteMany(theaterIds: string[]) {
        const deletedTheaters = await this.repository.deleteByIds(theaterIds)

        return { deletedTheaters: this.toDtos(deletedTheaters) }
    }

    async searchPage(searchDto: SearchTheatersPageDto) {
        const { items, ...pagination } = await this.repository.searchPage(searchDto)

        return { ...pagination, items: this.toDtos(items) }
    }

    async exists(theaterIds: string[]) {
        return this.repository.existByIds(theaterIds)
    }

    private toDto = (theater: TheaterDocument) =>
        mapDocToDto(theater, TheaterDto, ['id', 'name', 'location', 'seatmap'])

    private toDtos = (theaters: TheaterDocument[]) => theaters.map((theater) => this.toDto(theater))
}
