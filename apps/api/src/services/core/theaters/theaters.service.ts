import { type TransactionContext, ensure, mapDocToDto } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import {
    CreateTheaterDto,
    SearchTheatersPageDto,
    UpdateTheaterDto,
    TheaterDto
} from './dtos/index.js'
import { Theater } from './models/index.js'
import { TheatersRepository } from './theaters.repository.js'

@Injectable()
export class TheatersService {
    constructor(private readonly repository: TheatersRepository) {}

    async create(createDto: CreateTheaterDto) {
        const theater = await this.repository.create(createDto)

        return this.toDto(theater)
    }

    async deleteMany(theaterIds: string[]): Promise<void> {
        await this.repository.deleteByIds(theaterIds)
    }

    async acquireShowtimeScheduleGuards(
        theaterIds: string[],
        transaction: TransactionContext,
        signal: AbortSignal | undefined = undefined
    ) {
        return this.repository.acquireShowtimeScheduleGuards(theaterIds, transaction, signal)
    }

    async getMany(
        theaterIds: string[],
        transaction: TransactionContext | undefined = undefined,
        signal: AbortSignal | undefined = undefined
    ) {
        const theaters = await this.repository.getByIds(theaterIds, transaction, signal)

        const theaterDtos = this.toDtos(theaters)
        return theaterDtos
    }

    async searchPage(searchDto: SearchTheatersPageDto) {
        const { items, ...pagination } = await this.repository.searchPage(searchDto)

        return { ...pagination, items: this.toDtos(items) }
    }

    async update(theaterId: string, updateDto: UpdateTheaterDto) {
        const theater = await this.repository.update(theaterId, updateDto)

        return this.toDto(theater)
    }

    private toDto(theater: Theater) {
        return ensure(this.toDtos([theater])[0])
    }

    private toDtos(theaters: Theater[]) {
        return theaters.map((theater) =>
            mapDocToDto(theater, TheaterDto, ['id', 'name', 'location', 'seatmap'])
        )
    }
}
