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
        const startOfDay = new Date(showdate)
        startOfDay.setHours(0, 0, 0, 0)

        const endOfDay = new Date(showdate)
        endOfDay.setHours(23, 59, 59, 999)

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
