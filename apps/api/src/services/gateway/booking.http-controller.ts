import { LatLong, ParseLatLongQuery } from '@mannercode/common'
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
import { BookingService, HoldTicketsBodyDto } from 'application'
import { UserAuthGuard } from './guards'
import { ParseShowdatePipe } from './pipes'
import { UserAuthRequest } from './types'

@Controller('booking')
export class BookingHttpController {
    constructor(private readonly bookingService: BookingService) {}

    @Get('showtimes/:showtimeId/tickets')
    async getTicketsForShowtime(@Param('showtimeId') showtimeId: string) {
        return this.bookingService.getTickets(showtimeId)
    }

    @HttpCode(HttpStatus.NO_CONTENT)
    @Post('showtimes/:showtimeId/tickets/hold')
    @UseGuards(UserAuthGuard)
    async holdTickets(
        @Param('showtimeId') showtimeId: string,
        @Body() body: HoldTicketsBodyDto,
        @Req() req: UserAuthRequest
    ) {
        const userId = req.user.sub
        await this.bookingService.holdTickets({ userId, showtimeId, ticketIds: body.ticketIds })
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
        @Param('showdate', ParseShowdatePipe) showdate: Date
    ) {
        return this.bookingService.searchShowtimes({ movieId, showdate, theaterId })
    }

    @Get('movies/:movieId/theaters')
    async searchTheaters(
        @Param('movieId') movieId: string,
        @ParseLatLongQuery('latLong') latLong: LatLong
    ) {
        return this.bookingService.searchTheaters({ latLong, movieId })
    }
}
