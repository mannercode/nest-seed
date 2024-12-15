import { Injectable } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { convertStringToDate, LatLong } from 'common'
import { BookingService } from './booking.service'

@Injectable()
export class BookingController {
    constructor(private service: BookingService) {}

    @MessagePattern({ cmd: 'booking.findShowingTheaters' })
    async findShowingTheaters(
        @Payload('movieId') movieId: string,
        @Payload('latlong') latlong: LatLong
    ) {
        return this.service.findShowingTheaters({ movieId, latlong })
    }

    @MessagePattern({ cmd: 'booking.findShowdates' })
    async findShowdates(
        @Payload('movieId') movieId: string,
        @Payload('theaterId') theaterId: string
    ) {
        return this.service.findShowdates({ movieId, theaterId })
    }

    @MessagePattern({ cmd: 'booking.findShowtimes' })
    async findShowtimes(
        @Payload('movieId') movieId: string,
        @Payload('theaterId') theaterId: string,
        @Payload('showdate') showdate: string
    ) {
        return this.service.findShowtimes({
            movieId,
            theaterId,
            showdate: convertStringToDate(showdate)
        })
    }

    @MessagePattern({ cmd: 'booking.getAvailableTickets' })
    async getAvailableTickets(@Payload() showtimeId: string) {
        return this.service.getAvailableTickets(showtimeId)
    }

    @MessagePattern({ cmd: 'booking.holdTickets' })
    async holdTickets(
        @Payload('customerId') customerId: string,
        @Payload('showtimeId') showtimeId: string,
        @Payload('ticketIds') ticketIds: string[]
    ) {
        return this.service.holdTickets({ customerId, showtimeId, ticketIds })
    }
}
