import { LatLong, DateUtil, ParseLatLongQuery } from '@mannercode/common'
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
import { CustomerAuthRequest, CustomerJwtAuthGuard } from 'cores'
import { BookingService } from './booking.service'

@Controller('booking')
export class BookingHttpController {
    constructor(private readonly service: BookingService) {}

    @Get('showtimes/:showtimeId/tickets')
    async getTicketsForShowtime(@Param('showtimeId') showtimeId: string) {
        return this.service.getTickets(showtimeId)
    }

    @HttpCode(HttpStatus.OK)
    @Post('showtimes/:showtimeId/tickets/hold')
    @UseGuards(CustomerJwtAuthGuard)
    async holdTickets(
        @Param('showtimeId') showtimeId: string,
        @Body() body: { ticketIds: string[] },
        @Req() req: CustomerAuthRequest
    ) {
        const customerId = req.user.customerId
        return this.service.holdTickets({ customerId, showtimeId, ticketIds: body.ticketIds })
    }

    @Get('movies/:movieId/theaters/:theaterId/showdates')
    async searchShowdates(
        @Param('movieId') movieId: string,
        @Param('theaterId') theaterId: string
    ) {
        return this.service.searchShowdates({ movieId, theaterId })
    }

    @Get('movies/:movieId/theaters/:theaterId/showdates/:showdate/showtimes')
    async searchShowtimes(
        @Param('movieId') movieId: string,
        @Param('theaterId') theaterId: string,
        @Param('showdate') showdate: string
    ) {
        return this.service.searchShowtimes({
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
        return this.service.searchTheaters({ latLong, movieId })
    }
}
