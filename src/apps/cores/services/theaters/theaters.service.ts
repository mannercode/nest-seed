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

        const res = this.toDtos(theaters)
        return res
    }

    async deleteMany(theaterIds: string[]) {
        await this.repository.deleteByIds(theaterIds)
        return {}
    }

    async searchPage(searchDto: SearchTheatersPageDto) {
        const { items, ...pagination } = await this.repository.searchPage(searchDto)

        return { ...pagination, items: this.toDtos(items) }
    }

    async allExist(theaterIds: string[]) {
        return this.repository.allExist(theaterIds)
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
