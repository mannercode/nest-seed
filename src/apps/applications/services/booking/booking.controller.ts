import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { HoldTicketsDto } from 'apps/cores'
import { Messages } from 'shared'
import { BookingService } from './booking.service'
import {
    BookingSearchShowdatesDto,
    BookingSearchShowtimesDto,
    BookingSearchTheatersDto
} from './dtos'

@Controller()
export class BookingController {
    constructor(private readonly service: BookingService) {}

    @MessagePattern(Messages.Booking.getTickets)
    getTickets(@Payload() showtimeId: string) {
        return this.service.getTickets(showtimeId)
    }

    @MessagePattern(Messages.Booking.holdTickets)
    holdTickets(@Payload() dto: HoldTicketsDto) {
        return this.service.holdTickets(dto)
    }

    @MessagePattern(Messages.Booking.searchShowdates)
    searchShowdates(@Payload() dto: BookingSearchShowdatesDto) {
        return this.service.searchShowdates(dto)
    }

    @MessagePattern(Messages.Booking.searchShowtimes)
    searchShowtimes(@Payload() dto: BookingSearchShowtimesDto) {
        return this.service.searchShowtimes(dto)
    }

    @MessagePattern(Messages.Booking.searchTheaters)
    searchTheaters(@Payload() dto: BookingSearchTheatersDto) {
        return this.service.searchTheaters(dto)
    }
}
