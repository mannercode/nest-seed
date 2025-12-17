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
import { DateUtil, LatLong, LatLongQuery } from 'common'
import { CustomerJwtAuthGuard } from './guards'
import { CustomerAuthRequest } from './types'

@Controller('booking')
export class BookingController {
    constructor(private readonly bookingService: BookingClient) {}

    @Get('movies/:movieId/theaters')
    async searchTheaters(
        @Param('movieId') movieId: string,
        @LatLongQuery('latLong') latLong: LatLong
    ) {
        return this.bookingService.searchTheaters({ movieId, latLong })
    }

    @Get('movies/:movieId/theaters/:theaterId/showdates')
    async searchShowdates(
        @Param('movieId') movieId: string,
        @Param('theaterId') theaterId: string
    ) {
        return this.bookingService.searchShowdates({ movieId, theaterId })
    }

    @Get('movies/:movieId/theaters/:theaterId/showdates/:showdate/showtimes')
    async searchShowtimes(
        @Param('movieId') movieId: string,
        @Param('theaterId') theaterId: string,
        @Param('showdate') showdate: string
    ) {
        return this.bookingService.searchShowtimes({
            movieId,
            theaterId,
            showdate: DateUtil.fromYMD(showdate)
        })
    }

    @Get('showtimes/:showtimeId/tickets')
    async getTicketsForShowtime(@Param('showtimeId') showtimeId: string) {
        return this.bookingService.getTickets(showtimeId)
    }

    @UseGuards(CustomerJwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    @Post('showtimes/:showtimeId/tickets/hold')
    async holdTickets(
        @Param('showtimeId') showtimeId: string,
        @Body('ticketIds') ticketIds: string[],
        @Req() req: CustomerAuthRequest
    ) {
        const customerId = req.user.customerId
        return this.bookingService.holdTickets({ customerId, showtimeId, ticketIds })
    }
}
