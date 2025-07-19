import { Injectable } from '@nestjs/common'
import { mapDocToDto } from 'common'
import { CreateTheaterDto, SearchTheatersPageDto, TheaterDto, UpdateTheaterDto } from './dtos'
import { TheaterDocument } from './models'
import { TheatersRepository } from './theaters.repository'

@Injectable()
export class TheatersService {
    constructor(private repository: TheatersRepository) {}

    async createTheater(createDto: CreateTheaterDto) {
        const theater = await this.repository.createTheater(createDto)
        return this.toDto(theater)
    }

    async updateTheater(theaterId: string, updateDto: UpdateTheaterDto) {
        const theater = await this.repository.updateTheater(theaterId, updateDto)
        return this.toDto(theater)
    }

    async getTheaters(theaterIds: string[]) {
        const theaters = await this.repository.getByIds(theaterIds)
        return this.toDtos(theaters)
    }

    async deleteTheaters(theaterIds: string[]) {
        const deleteResult = await this.repository.deleteByIds(theaterIds)
        return deleteResult
    }

    async searchTheatersPage(searchDto: SearchTheatersPageDto) {
        const { items, ...pagination } = await this.repository.searchTheatersPage(searchDto)

        return { ...pagination, items: this.toDtos(items) }
    }

    async theatersExist(theaterIds: string[]) {
        return this.repository.existByIds(theaterIds)
    }

    private toDto = (theater: TheaterDocument) =>
        mapDocToDto(theater, TheaterDto, ['id', 'name', 'location', 'seatmap'])

    private toDtos = (theaters: TheaterDocument[]) => theaters.map((theater) => this.toDto(theater))
}
