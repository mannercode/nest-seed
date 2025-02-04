import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { TheaterCreateDto, TheaterQueryDto, TheaterUpdateDto } from './dtos'
import { TheatersService } from './theaters.service'

@Controller()
export class TheatersController {
    constructor(private service: TheatersService) {}

    @MessagePattern({ cmd: 'createTheater' })
    createTheater(@Payload() createDto: TheaterCreateDto) {
        return this.service.createTheater(createDto)
    }

    @MessagePattern({ cmd: 'updateTheater' })
    updateTheater(
        @Payload('theaterId') theaterId: string,
        @Payload('updateDto') updateDto: TheaterUpdateDto
    ) {
        return this.service.updateTheater(theaterId, updateDto)
    }

    @MessagePattern({ cmd: 'getTheater' })
    getTheater(@Payload() theaterId: string) {
        return this.service.getTheater(theaterId)
    }

    @MessagePattern({ cmd: 'deleteTheater' })
    deleteTheater(@Payload() theaterId: string) {
        return this.service.deleteTheater(theaterId)
    }

    @MessagePattern({ cmd: 'findTheaters' })
    findTheaters(@Payload() queryDto: TheaterQueryDto) {
        return this.service.findTheaters(queryDto)
    }

    @MessagePattern({ cmd: 'getTheatersByIds' })
    getTheatersByIds(@Payload() theaterIds: string[]) {
        return this.service.getTheatersByIds(theaterIds)
    }

    @MessagePattern({ cmd: 'theatersExist' })
    theatersExist(@Payload() theaterIds: string[]) {
        return this.service.theatersExist(theaterIds)
    }
}
