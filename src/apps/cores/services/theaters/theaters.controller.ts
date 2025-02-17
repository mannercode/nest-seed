import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Routes } from 'shared/config'
import { TheaterCreateDto, TheaterQueryDto, TheaterUpdateDto } from './dtos'
import { TheatersService } from './theaters.service'

@Controller()
export class TheatersController {
    constructor(private service: TheatersService) {}

    @MessagePattern(Routes.Messages.Theaters.createTheater)
    createTheater(@Payload() createDto: TheaterCreateDto) {
        return this.service.createTheater(createDto)
    }

    @MessagePattern(Routes.Messages.Theaters.updateTheater)
    updateTheater(
        @Payload('theaterId') theaterId: string,
        @Payload('updateDto') updateDto: TheaterUpdateDto
    ) {
        return this.service.updateTheater(theaterId, updateDto)
    }

    @MessagePattern(Routes.Messages.Theaters.getTheater)
    getTheater(@Payload() theaterId: string) {
        return this.service.getTheater(theaterId)
    }

    @MessagePattern(Routes.Messages.Theaters.deleteTheater)
    deleteTheater(@Payload() theaterId: string) {
        return this.service.deleteTheater(theaterId)
    }

    @MessagePattern(Routes.Messages.Theaters.findTheaters)
    findTheaters(@Payload() queryDto: TheaterQueryDto) {
        return this.service.findTheaters(queryDto)
    }

    @MessagePattern(Routes.Messages.Theaters.getTheatersByIds)
    getTheatersByIds(@Payload() theaterIds: string[]) {
        return this.service.getTheatersByIds(theaterIds)
    }

    @MessagePattern(Routes.Messages.Theaters.theatersExist)
    theatersExist(@Payload() theaterIds: string[]) {
        return this.service.theatersExist(theaterIds)
    }
}
