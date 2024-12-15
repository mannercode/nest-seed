import { Injectable } from '@nestjs/common'
import { MethodLog } from 'common'
import {
    nullTheaterDto,
    TheaterCreateDto,
    TheaterDto,
    TheaterQueryDto,
    TheaterUpdateDto
} from 'types'

@Injectable()
export class TheatersService {
    constructor() {}

    @MethodLog()
    async createTheater(createDto: TheaterCreateDto): Promise<TheaterDto> {
        return nullTheaterDto
    }

    @MethodLog()
    async updateTheater(theaterId: string, updateDto: TheaterUpdateDto): Promise<TheaterDto> {
        return nullTheaterDto
    }

    @MethodLog({ level: 'verbose' })
    async getTheater(theaterId: string): Promise<TheaterDto> {
        return nullTheaterDto
    }

    @MethodLog()
    async deleteTheater(theaterId: string): Promise<boolean> {
        return true
    }

    @MethodLog({ level: 'verbose' })
    async findTheaters(queryDto: TheaterQueryDto): Promise<TheaterDto[]> {
        return []
    }

    @MethodLog({ level: 'verbose' })
    async getTheatersByIds(theaterIds: string[]): Promise<TheaterDto[]> {
        return []
    }

    @MethodLog({ level: 'verbose' })
    async theatersExist(theaterIds: string[]): Promise<boolean> {
        return false
    }
}
