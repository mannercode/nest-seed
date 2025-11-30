import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Messages } from 'shared'
import { BookingService } from './booking.service'
import {
    SearchTheatersForBookingDto,
    SearchShowdatesForBookingDto,
    SearchShowtimesForBookingDto
} from './dtos'
import { HoldTicketsDto } from 'apps/cores'

@Controller()
export class BookingController {
    constructor(private readonly service: BookingService) {}

    @MessagePattern(Messages.Booking.searchTheaters)
    searchTheaters(@Payload() dto: SearchTheatersForBookingDto) {
        return this.service.searchTheaters(dto)
    }

    @MessagePattern(Messages.Booking.searchShowdates)
    searchShowdates(@Payload() dto: SearchShowdatesForBookingDto) {
        return this.service.searchShowdates(dto)
    }

    @MessagePattern(Messages.Booking.searchShowtimes)
    searchShowtimes(@Payload() dto: SearchShowtimesForBookingDto) {
        return this.service.searchShowtimes(dto)
    }

    @MessagePattern(Messages.Booking.getTickets)
    getTickets(@Payload() showtimeId: string) {
        return this.service.getTickets(showtimeId)
    }

    @MessagePattern(Messages.Booking.holdTickets)
    holdTickets(@Payload() dto: HoldTicketsDto) {
        return this.service.holdTickets(dto)
    }
}
