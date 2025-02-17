import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { LatLong } from 'common'
import { Routes } from 'shared/config'
import { BookingService } from './booking.service'

@Controller()
export class BookingController {
    constructor(private service: BookingService) {}

    @MessagePattern(Routes.Messages.Booking.findShowingTheaters)
    findShowingTheaters(@Payload('movieId') movieId: string, @Payload('latlong') latlong: LatLong) {
        return this.service.findShowingTheaters({ movieId, latlong })
    }

    @MessagePattern(Routes.Messages.Booking.findShowdates)
    findShowdates(@Payload('movieId') movieId: string, @Payload('theaterId') theaterId: string) {
        return this.service.findShowdates({ movieId, theaterId })
    }

    @MessagePattern(Routes.Messages.Booking.findShowtimes)
    findShowtimes(
        @Payload('movieId') movieId: string,
        @Payload('theaterId') theaterId: string,
        @Payload('showdate') showdate: Date
    ) {
        return this.service.findShowtimes({ movieId, theaterId, showdate })
    }

    @MessagePattern(Routes.Messages.Booking.getAvailableTickets)
    getAvailableTickets(@Payload() showtimeId: string) {
        return this.service.getAvailableTickets(showtimeId)
    }

    @MessagePattern(Routes.Messages.Booking.holdTickets)
    holdTickets(
        @Payload('customerId') customerId: string,
        @Payload('showtimeId') showtimeId: string,
        @Payload('ticketIds') ticketIds: string[]
    ) {
        return this.service.holdTickets({ customerId, showtimeId, ticketIds })
    }
}
