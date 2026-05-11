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
 * URL의 YYYYMMDD를 UTC 자정 Date로 바꿉니다. UTC로 맞추는 이유는
 * `BookingService`의 검색 범위와 Mongo `$dateToString`의 결과가 모두
 * UTC 기준이라서입니다. 호스트 시간대를 섞으면 호스트가 UTC가 아닐 때
 * 결과가 어긋납니다.
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
    // `Date.UTC`는 13월이나 2월 30일 같은 값을 조용히 보정해 다른 달로
    // 넘깁니다. 그래서 한 번 만든 Date를 다시 분해해 원본과 같은지 확인합니다.
    // 다르면 달력에 없는 날짜였다는 뜻입니다.
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
