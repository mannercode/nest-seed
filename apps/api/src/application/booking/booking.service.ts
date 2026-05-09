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
        // endTime > now 필터로 과거 상영시간 제외. recommendation/showtime-creation
        // 이 모두 future 필터를 거는 것과 일치. cutoff 컷은 결제 시점에서 본다.
        return this.showtimesService.searchShowdates({
            endTimeRange: { start: new Date() },
            movieIds: [movieId],
            theaterIds: [theaterId]
        })
    }

    async searchShowtimes({ movieId, showdate, theaterId }: BookingSearchShowtimesDto) {
        // showdate 는 YYYYMMDD 로 들어오는데, 짝이 되는 searchShowdates 가
        // Mongo `$dateToString` (timezone 명시 없음 → UTC) 으로 만든 UTC 자정
        // Date 들을 돌려준다. 그래서 이 경계도 UTC 자정 기준으로 잡아야 두
        // 메서드 결과가 비-UTC 컨테이너에서도 어긋나지 않는다.
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
