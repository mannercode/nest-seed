import { LatLong, ParseLatLongQuery } from '@mannercode/common'
import {
    BadRequestException,
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
import { UserJwtAuthGuard } from './guards'
import { UserAuthRequest } from './types'

const SHOWDATE_PATTERN = /^(\d{4})(\d{2})(\d{2})$/

/**
 * URL path 의 YYYYMMDD 를 UTC 자정 Date 로 파싱한다. UTC 기준인 이유는
 * BookingService 의 검색 경계 / Mongo `$dateToString` 결과와 일치시키기 위함 —
 * server local TZ 를 끼워 넣으면 비-UTC 컨테이너에서 결과가 어긋난다.
 */
function parseShowdate(value: string): Date {
    const match = SHOWDATE_PATTERN.exec(value)
    if (!match) {
        throw new BadRequestException({
            code: 'ERR_BOOKING_SHOWDATE_INVALID',
            message: 'showdate must be in YYYYMMDD format',
            showdate: value
        })
    }
    const [, yearStr, monthStr, dayStr] = match
    const year = Number(yearStr)
    const month = Number(monthStr)
    const day = Number(dayStr)
    const ms = Date.UTC(year, month - 1, day)
    const date = new Date(ms)
    // Date.UTC 는 month/day overflow 를 silent 로 보정한다 (예: 13 → 다음 해 1월).
    // round-trip 비교로 입력이 실제 달력일자였는지 확인한다.
    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        throw new BadRequestException({
            code: 'ERR_BOOKING_SHOWDATE_INVALID',
            message: 'showdate must be a valid calendar date',
            showdate: value
        })
    }
    return date
}

@Controller('booking')
export class BookingHttpController {
    constructor(private readonly bookingService: BookingService) {}

    @Get('showtimes/:showtimeId/tickets')
    async getTicketsForShowtime(@Param('showtimeId') showtimeId: string) {
        return this.bookingService.getTickets(showtimeId)
    }

    @HttpCode(HttpStatus.NO_CONTENT)
    @Post('showtimes/:showtimeId/tickets/hold')
    @UseGuards(UserJwtAuthGuard)
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
        @Param('showdate') showdate: string
    ) {
        return this.bookingService.searchShowtimes({
            movieId,
            showdate: parseShowdate(showdate),
            theaterId
        })
    }

    @Get('movies/:movieId/theaters')
    async searchTheaters(
        @Param('movieId') movieId: string,
        @ParseLatLongQuery('latLong') latLong: LatLong
    ) {
        return this.bookingService.searchTheaters({ latLong, movieId })
    }
}
