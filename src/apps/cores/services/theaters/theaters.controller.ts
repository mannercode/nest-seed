import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { TheaterCreateDto, TheaterQueryDto, TheaterUpdateDto } from './dtos'
import { TheatersService } from './theaters.service'

@Controller()
export class TheatersController {
    constructor(private service: TheatersService) {}

    @MessagePattern('nestSeed.cores.theaters.createTheater.*')
    createTheater(@Payload() createDto: TheaterCreateDto) {
        return this.service.createTheater(createDto)
    }

    @MessagePattern('nestSeed.cores.theaters.updateTheater.*')
    updateTheater(
        @Payload('theaterId') theaterId: string,
        @Payload('updateDto') updateDto: TheaterUpdateDto
    ) {
        return this.service.updateTheater(theaterId, updateDto)
    }

    @MessagePattern('nestSeed.cores.theaters.getTheater.*')
    getTheater(@Payload() theaterId: string) {
        return this.service.getTheater(theaterId)
    }

    @MessagePattern('nestSeed.cores.theaters.deleteTheater.*')
    deleteTheater(@Payload() theaterId: string) {
        return this.service.deleteTheater(theaterId)
    }

    @MessagePattern('nestSeed.cores.theaters.findTheaters.*')
    findTheaters(@Payload() queryDto: TheaterQueryDto) {
        return this.service.findTheaters(queryDto)
    }

    @MessagePattern('nestSeed.cores.theaters.getTheatersByIds.*')
    getTheatersByIds(@Payload() theaterIds: string[]) {
        return this.service.getTheatersByIds(theaterIds)
    }

    @MessagePattern('nestSeed.cores.theaters.theatersExist.*')
    theatersExist(@Payload() theaterIds: string[]) {
        return this.service.theatersExist(theaterIds)
    }
}
