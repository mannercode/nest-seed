import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common'
import { AuthTokenPayload, LatLong, LatLongPipe } from 'common'
import { CustomerJwtAuthGuard } from './guards'
import { BookingService } from 'services/booking'

@Controller('booking')
export class BookingController {
    constructor(private service: BookingService) {}

    @Get('booking/movies/:movieId/theaters')
    async findShowingTheaters(
        @Param('movieId') movieId: string,
        @Query('latlong', LatLongPipe) latlong: LatLong
    ) {
        return this.service.findShowingTheaters({ movieId, latlong })
    }

    @Get('booking/movies/:movieId/theaters/:theaterId/showdates')
    async findShowdates(@Param('movieId') movieId: string, @Param('theaterId') theaterId: string) {
        return this.service.findShowdates({ movieId, theaterId })
    }

    @Get('booking/movies/:movieId/theaters/:theaterId/showdates/:showdate/showtimes')
    async findShowtimes(
        @Param('movieId') movieId: string,
        @Param('theaterId') theaterId: string,
        @Param('showdate') showdate: string
    ) {
        return this.service.findShowtimes({ movieId, theaterId, showdate })
    }

    @Get('booking/showtimes/${showtimeId}/tickets')
    async getTicketsForShowtime(@Param('showtimeId') showtimeId: string) {
        return this.service.getAvailableTickets(showtimeId)
    }

    @UseGuards(CustomerJwtAuthGuard)
    @Patch('booking/showtimes/${showtimeId}/tickets')
    async holdTickets(
        @Param('showtimeId') showtimeId: string,
        @Body('ticketIds') ticketIds: string[],
        @Req() req: { user: AuthTokenPayload }
    ) {
        const customerId = req.user.userId
        return this.service.holdTickets({ customerId, showtimeId, ticketIds })
    }
}
