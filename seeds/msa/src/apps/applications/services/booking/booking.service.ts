import { pickIds } from '@mannercode/common'
import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import {
    HoldTicketsDto,
    ShowtimesClient,
    TheatersClient,
    TicketHoldingClient,
    TicketsClient
} from 'apps/cores'
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
        private readonly showtimesClient: ShowtimesClient,
        private readonly theatersClient: TheatersClient,
        private readonly ticketHoldingClient: TicketHoldingClient,
        private readonly ticketsClient: TicketsClient
    ) {}

    async getTickets(showtimeId: string) {
        const showtimeExists = await this.showtimesClient.allExist([showtimeId])

        if (!showtimeExists) {
            throw new NotFoundException(BookingErrors.ShowtimeNotFound(showtimeId))
        }

        const tickets = await this.ticketsClient.search({ showtimeIds: [showtimeId] })
        return tickets
    }

    async holdTickets(dto: HoldTicketsDto) {
        this.logger.log('holdTickets', {
            customerId: dto.customerId,
            ticketCount: dto.ticketIds.length
        })

        const success = await this.ticketHoldingClient.holdTickets(dto)

        if (!success) {
            throw new ConflictException(BookingErrors.TicketsAlreadyHeld())
        }

        return { success }
    }

    async searchShowdates({ movieId, theaterId }: BookingSearchShowdatesDto) {
        return this.showtimesClient.searchShowdates({
            movieIds: [movieId],
            theaterIds: [theaterId]
        })
    }

    async searchShowtimes({ movieId, showdate, theaterId }: BookingSearchShowtimesDto) {
        const startOfDay = new Date(showdate)
        startOfDay.setHours(0, 0, 0, 0)

        const endOfDay = new Date(showdate)
        endOfDay.setHours(23, 59, 59, 999)

        const showtimes = await this.showtimesClient.search({
            movieIds: [movieId],
            startTimeRange: { end: endOfDay, start: startOfDay },
            theaterIds: [theaterId]
        })

        const showtimeIds = pickIds(showtimes)
        const ticketSalesForShowtimes = await this.ticketsClient.aggregateSales({ showtimeIds })

        const showtimesForBooking = generateShowtimesForBooking(showtimes, ticketSalesForShowtimes)

        return showtimesForBooking
    }

    async searchTheaters({ latLong, movieId }: BookingSearchTheatersDto) {
        const theaterIds = await this.showtimesClient.searchTheaterIds({ movieIds: [movieId] })
        const theaters = await this.theatersClient.getMany(theaterIds)
        const showingTheaters = sortTheatersByDistance(theaters, latLong)

        this.logger.log('searchTheaters', { movieId, theaterCount: showingTheaters.length })

        return showingTheaters
    }
}
