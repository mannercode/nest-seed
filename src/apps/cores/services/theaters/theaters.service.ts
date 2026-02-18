import { Injectable } from '@nestjs/common'
import { mapDocToDto } from 'common'
import { CreateTheaterDto, SearchTheatersPageDto, TheaterDto, UpdateTheaterDto } from './dtos'
import { Theater } from './models'
import { TheatersRepository } from './theaters.repository'

@Injectable()
export class TheatersService {
    constructor(private readonly repository: TheatersRepository) {}

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

        const theaterDtos = this.toDtos(theaters)
        return theaterDtos
    }

    async deleteMany(theaterIds: string[]): Promise<void> {
        await this.repository.deleteByIds(theaterIds)
    }

    async searchPage(searchDto: SearchTheatersPageDto) {
        const { items, ...pagination } = await this.repository.searchPage(searchDto)

        return { ...pagination, items: this.toDtos(items) }
    }

    async existsAll(theaterIds: string[]) {
        return this.repository.existsAll(theaterIds)
    }

    private toDto(theater: Theater) {
        return this.toDtos([theater])[0]
    }

    private toDtos(theaters: Theater[]) {
        return theaters.map((theater) =>
            mapDocToDto(theater, TheaterDto, ['id', 'name', 'location', 'seatmap'])
        )
    }
}
