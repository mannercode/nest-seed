import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common'
import { AuthTokenPayload, convertStringToDate, LatLong, LatLongQuery } from 'common'
import { BookingService } from 'services/applications'
import { CustomerJwtAuthGuard } from './guards'

@Controller('booking')
export class BookingController {
    constructor(private service: BookingService) {}

    @Get('movies/:movieId/theaters')
    async findShowingTheaters(
        @Param('movieId') movieId: string,
        @LatLongQuery('latlong') latlong: LatLong
    ) {
        return this.service.findShowingTheaters({ movieId, latlong })
    }

    @Get('movies/:movieId/theaters/:theaterId/showdates')
    async findShowdates(@Param('movieId') movieId: string, @Param('theaterId') theaterId: string) {
        return this.service.findShowdates({ movieId, theaterId })
    }

    @Get('movies/:movieId/theaters/:theaterId/showdates/:showdate/showtimes')
    async findShowtimes(
        @Param('movieId') movieId: string,
        @Param('theaterId') theaterId: string,
        @Param('showdate') showdate: string
    ) {
        return this.service.findShowtimes({
            movieId,
            theaterId,
            showdate: convertStringToDate(showdate)
        })
    }

    @Get('showtimes/:showtimeId/tickets')
    async getTicketsForShowtime(@Param('showtimeId') showtimeId: string) {
        return this.service.getAvailableTickets(showtimeId)
    }

    @UseGuards(CustomerJwtAuthGuard)
    @Patch('showtimes/:showtimeId/tickets')
    async holdTickets(
        @Param('showtimeId') showtimeId: string,
        @Body('ticketIds') ticketIds: string[],
        @Req() req: { user: AuthTokenPayload }
    ) {
        const customerId = req.user.userId
        return this.service.holdTickets({ customerId, showtimeId, ticketIds })
    }
}
