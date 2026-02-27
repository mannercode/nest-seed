import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Req,
    UseGuards
} from '@nestjs/common'
import { BookingClient } from 'apps/applications'
import { LatLong } from 'common'
import { DateUtil, ParseLatLongQuery } from 'common'
import { CustomerJwtAuthGuard } from './guards'
import { CustomerAuthRequest } from './types'

@Controller('booking')
export class BookingHttpController {
    constructor(private readonly bookingClient: BookingClient) {}

    @Get('showtimes/:showtimeId/tickets')
    async getTicketsForShowtime(@Param('showtimeId') showtimeId: string) {
        return this.bookingClient.getTickets(showtimeId)
    }

    @HttpCode(HttpStatus.OK)
    @Post('showtimes/:showtimeId/tickets/hold')
    @UseGuards(CustomerJwtAuthGuard)
    async holdTickets(
        @Param('showtimeId') showtimeId: string,
        @Body('ticketIds') ticketIds: string[],
        @Req() req: CustomerAuthRequest
    ) {
        const customerId = req.user.customerId
        return this.bookingClient.holdTickets({ customerId, showtimeId, ticketIds })
    }

    @Get('movies/:movieId/theaters/:theaterId/showdates')
    async searchShowdates(
        @Param('movieId') movieId: string,
        @Param('theaterId') theaterId: string
    ) {
        return this.bookingClient.searchShowdates({ movieId, theaterId })
    }

    @Get('movies/:movieId/theaters/:theaterId/showdates/:showdate/showtimes')
    async searchShowtimes(
        @Param('movieId') movieId: string,
        @Param('theaterId') theaterId: string,
        @Param('showdate') showdate: string
    ) {
        return this.bookingClient.searchShowtimes({
            movieId,
            showdate: DateUtil.fromYMD(showdate),
            theaterId
        })
    }

    @Get('movies/:movieId/theaters')
    async searchTheaters(
        @Param('movieId') movieId: string,
        @ParseLatLongQuery('latLong') latLong: LatLong
    ) {
        return this.bookingClient.searchTheaters({ latLong, movieId })
    }
}
