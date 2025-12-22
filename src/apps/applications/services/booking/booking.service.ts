import { Injectable, NotFoundException } from '@nestjs/common'
import {
    HoldTicketsDto,
    ShowtimesClient,
    TheatersClient,
    TicketHoldingClient,
    TicketsClient
} from 'apps/cores'
import { pickIds } from 'common'
import { generateShowtimesForBooking, sortTheatersByDistance } from './booking.utils'
import {
    SearchShowdatesForBookingDto,
    SearchShowtimesForBookingDto,
    SearchTheatersForBookingDto
} from './dtos'

export const BookingServiceErrors = {
    ShowtimeNotFound: {
        code: 'ERR_BOOKING_SHOWTIME_NOT_FOUND',
        message: 'The requested showtime could not be found.'
    }
}

@Injectable()
export class BookingService {
    constructor(
        private readonly showtimesClient: ShowtimesClient,
        private readonly theatersClient: TheatersClient,
        private readonly ticketHoldingClient: TicketHoldingClient,
        private readonly ticketsClient: TicketsClient
    ) {}

    async searchTheaters({ movieId, latLong }: SearchTheatersForBookingDto) {
        const theaterIds = await this.showtimesClient.searchTheaterIds({ movieIds: [movieId] })
        const theaters = await this.theatersClient.getMany(theaterIds)
        const showingTheaters = sortTheatersByDistance(theaters, latLong)

        return showingTheaters
    }

    async searchShowdates({ movieId, theaterId }: SearchShowdatesForBookingDto) {
        return this.showtimesClient.searchShowdates({
            movieIds: [movieId],
            theaterIds: [theaterId]
        })
    }

    async searchShowtimes({ movieId, theaterId, showdate }: SearchShowtimesForBookingDto) {
        const startOfDay = new Date(showdate)
        startOfDay.setHours(0, 0, 0, 0)

        const endOfDay = new Date(showdate)
        endOfDay.setHours(23, 59, 59, 999)

        const showtimes = await this.showtimesClient.search({
            movieIds: [movieId],
            theaterIds: [theaterId],
            startTimeRange: { start: startOfDay, end: endOfDay }
        })

        const showtimeIds = pickIds(showtimes)
        const ticketSalesForShowtimes = await this.ticketsClient.aggregateSales({ showtimeIds })

        const showtimesForBooking = generateShowtimesForBooking(showtimes, ticketSalesForShowtimes)

        return showtimesForBooking
    }

    async getTickets(showtimeId: string) {
        const showtimeExists = await this.showtimesClient.allExist([showtimeId])

        if (!showtimeExists) {
            throw new NotFoundException({ ...BookingServiceErrors.ShowtimeNotFound, showtimeId })
        }

        const tickets = await this.ticketsClient.search({ showtimeIds: [showtimeId] })
        return tickets
    }

    async holdTickets(dto: HoldTicketsDto) {
        const success = await this.ticketHoldingClient.holdTickets(dto)
        return { success }
    }
}
