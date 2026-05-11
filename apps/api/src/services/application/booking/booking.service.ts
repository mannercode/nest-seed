import { pickIds } from '@mannercode/common'
import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import {
    HoldTicketsDto,
    ShowtimesService,
    TheatersService,
    TicketHoldingService,
    TicketsService
} from 'core'
import { generateShowtimesForBooking, sortTheatersByDistance } from './booking.utils'
import {
    BookingSearchShowdatesDto,
    BookingSearchShowtimesDto,
    BookingSearchTheatersDto
} from './dtos'
import { BookingErrors } from './errors'

@Injectable()
export class BookingService {
    private readonly logger = new Logger(BookingService.name)

    constructor(
        private readonly showtimesService: ShowtimesService,
        private readonly theatersService: TheatersService,
        private readonly ticketHoldingService: TicketHoldingService,
        private readonly ticketsService: TicketsService
    ) {}

    async getTickets(showtimeId: string) {
        const showtimeExists = await this.showtimesService.allExist([showtimeId])

        if (!showtimeExists) {
            throw new NotFoundException(BookingErrors.ShowtimeNotFound(showtimeId))
        }

        const tickets = await this.ticketsService.search({ showtimeIds: [showtimeId] })
        return tickets
    }

    async holdTickets(dto: HoldTicketsDto): Promise<void> {
        this.logger.log('holdTickets', { userId: dto.userId, ticketCount: dto.ticketIds.length })

        const success = await this.ticketHoldingService.holdTickets(dto)

        if (!success) {
            throw new ConflictException(BookingErrors.TicketsAlreadyHeld())
        }
    }

    async searchShowdates({ movieId, theaterId }: BookingSearchShowdatesDto) {
        // 끝난 상영은 보여 주지 않으려고 `endTime > now` 로 거른다. 추천과
        // 상영 생성 화면도 같은 방식으로 미래 상영만 본다. 결제 마감 시간은
        // 결제 시점에서 따로 확인한다.
        return this.showtimesService.searchShowdates({
            endTimeRange: { start: new Date() },
            movieIds: [movieId],
            theaterIds: [theaterId]
        })
    }

    async searchShowtimes({ movieId, showdate, theaterId }: BookingSearchShowtimesDto) {
        // `showdate` 는 YYYYMMDD 로 들어온다. 짝이 되는 `searchShowdates` 는
        // mongo `$dateToString` 의 UTC 결과를 그대로 돌려준다. 이쪽도 UTC
        // 자정 기준으로 범위를 잡아야 두 API 결과가 호스트 시간대와 상관없이
        // 맞는다.
        const startOfDay = new Date(showdate)
        startOfDay.setUTCHours(0, 0, 0, 0)

        const endOfDay = new Date(showdate)
        endOfDay.setUTCHours(23, 59, 59, 999)

        const showtimes = await this.showtimesService.search({
            endTimeRange: { start: new Date() },
            movieIds: [movieId],
            startTimeRange: { end: endOfDay, start: startOfDay },
            theaterIds: [theaterId]
        })

        const showtimeIds = pickIds(showtimes)
        const ticketSalesForShowtimes = await this.ticketsService.aggregateSales({ showtimeIds })

        const showtimesForBooking = generateShowtimesForBooking(showtimes, ticketSalesForShowtimes)

        return showtimesForBooking
    }

    async searchTheaters({ latLong, movieId }: BookingSearchTheatersDto) {
        const theaterIds = await this.showtimesService.searchTheaterIds({
            endTimeRange: { start: new Date() },
            movieIds: [movieId]
        })
        const theaters = await this.theatersService.getMany(theaterIds)
        const showingTheaters = sortTheatersByDistance(theaters, latLong)

        this.logger.log('searchTheaters', { movieId, theaterCount: showingTheaters.length })

        return showingTheaters
    }
}
