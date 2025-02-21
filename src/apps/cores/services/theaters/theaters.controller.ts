import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Subjects } from 'shared/config'
import { TheaterCreateDto, TheaterQueryDto, TheaterUpdateDto } from './dtos'
import { TheatersService } from './theaters.service'

@Controller()
export class TheatersController {
    constructor(private service: TheatersService) {}

    @MessagePattern(Subjects.Theaters.createTheater)
    createTheater(@Payload() createDto: TheaterCreateDto) {
        return this.service.createTheater(createDto)
    }

    @MessagePattern(Subjects.Theaters.updateTheater)
    updateTheater(
        @Payload('theaterId') theaterId: string,
        @Payload('updateDto') updateDto: TheaterUpdateDto
    ) {
        return this.service.updateTheater(theaterId, updateDto)
    }

    @MessagePattern(Subjects.Theaters.getTheater)
    getTheater(@Payload() theaterId: string) {
        return this.service.getTheater(theaterId)
    }

    @MessagePattern(Subjects.Theaters.deleteTheater)
    deleteTheater(@Payload() theaterId: string) {
        return this.service.deleteTheater(theaterId)
    }

    @MessagePattern(Subjects.Theaters.findTheaters)
    findTheaters(@Payload() queryDto: TheaterQueryDto) {
        return this.service.findTheaters(queryDto)
    }

    @MessagePattern(Subjects.Theaters.getTheatersByIds)
    getTheatersByIds(@Payload() theaterIds: string[]) {
        return this.service.getTheatersByIds(theaterIds)
    }

    @MessagePattern(Subjects.Theaters.theatersExist)
    theatersExist(@Payload() theaterIds: string[]) {
        return this.service.theatersExist(theaterIds)
    }
}
