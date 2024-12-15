import { Injectable } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { TheaterCreateDto, TheaterQueryDto, TheaterUpdateDto } from 'types'
import { TheatersService } from './theaters.service'

@Injectable()
export class TheatersController {
    constructor(private service: TheatersService) {}

    @MessagePattern({ cmd: 'createTheater' })
    async createTheater(@Payload() createDto: TheaterCreateDto) {
        return this.service.createTheater(createDto)
    }

    @MessagePattern({ cmd: 'updateTheater' })
    async updateTheater(
        @Payload('theaterId') theaterId: string,
        @Payload('updateDto') updateDto: TheaterUpdateDto
    ) {
        return this.service.updateTheater(theaterId, updateDto)
    }

    @MessagePattern({ cmd: 'getTheater' })
    async getTheater(@Payload() theaterId: string) {
        return this.service.getTheater(theaterId)
    }

    @MessagePattern({ cmd: 'deleteTheater' })
    async deleteTheater(@Payload() theaterId: string) {
        return this.service.deleteTheater(theaterId)
    }

    @MessagePattern({ cmd: 'findTheaters' })
    async findTheaters(@Payload() queryDto: TheaterQueryDto) {
        return this.service.findTheaters(queryDto)
    }

    @MessagePattern({ cmd: 'getTheatersByIds' })
    async getTheatersByIds(@Payload() theaterIds: string[]) {
        return this.service.getTheatersByIds(theaterIds)
    }

    @MessagePattern({ cmd: 'theatersExist' })
    async theatersExist(@Payload() theaterIds: string[]) {
        return this.service.theatersExist(theaterIds)
    }
}
