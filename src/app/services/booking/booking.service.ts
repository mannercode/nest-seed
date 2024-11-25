import { Injectable } from '@nestjs/common'
import { LatLong, MethodLog, pickIds } from 'common'
import { ShowtimesService } from 'services/showtimes'
import { TheatersService } from 'services/theaters'
import { TicketHoldingService } from 'services/ticket-holding'
import { TicketsService } from 'services/tickets'
import { generateShowtimesWithSalesStatus, sortTheatersByDistance } from './booking.utils'

@Injectable()
export class BookingService {
    constructor(
        private showtimesService: ShowtimesService,
        private theatersService: TheatersService,
        private ticketHoldingService: TicketHoldingService,
        private ticketsService: TicketsService
    ) {}

    @MethodLog({ level: 'verbose' })
    async findShowingTheaters(args: { movieId: string; latlong: LatLong }) {
        const { movieId, latlong } = args
        const theaterIds = await this.showtimesService.findTheaterIdsByMovieId(movieId)
        const theaters = await this.theatersService.getTheatersByIds(theaterIds)
        const showingTheaters = sortTheatersByDistance(theaters, latlong)

        return showingTheaters
    }

    @MethodLog({ level: 'verbose' })
    async findShowdates(args: { movieId: string; theaterId: string }) {
        return this.showtimesService.findShowdates(args)
    }

    @MethodLog({ level: 'verbose' })
    async findShowtimes(args: { movieId: string; theaterId: string; showdate: Date }) {
        const { movieId, theaterId, showdate } = args

        const startOfDay = new Date(showdate)
        startOfDay.setHours(0, 0, 0, 0)

        const endOfDay = new Date(showdate)
        endOfDay.setHours(23, 59, 59, 999)

        const showtimes = await this.showtimesService.findAllShowtimes({
            movieIds: [movieId],
            theaterIds: [theaterId],
            startTimeRange: { start: startOfDay, end: endOfDay }
        })

        const ids= pickIds(showtimes)
        const salesStatuses = await this.ticketsService.getSalesStatuses(ids)

        const showtimesWithSalesStatus = generateShowtimesWithSalesStatus(
            showtimes,
            salesStatuses
        )

        return showtimesWithSalesStatus
    }

    @MethodLog({ level: 'verbose' })
    async getAvailableTickets(showtimeId: string) {
        //     Booking -> Tickets: findAllTickets({showtimeId})
        //     Booking <-- Tickets: tickets[]
        // Backend <-- Booking: tickets[]
        // return this.service.getTicketsForShowtime(showtimeId)
    }

    @MethodLog({ level: 'verbose' })
    async holdTickets(args: { customerId: string; showtimeId: string; ticketIds: string[] }) {
        const { customerId, showtimeId, ticketIds } = args
        const seatHoldExpirationTime = 10 * 60 * 1000

        // Booking -> TicketHolding: holdTickets(showtimeId, customerId, ticketIds[], ttlMs=10*60*1000)
        // TicketHolding -> TicketHolding: releaseTickets(showtimeId, customerId)
        // TicketHolding -> TicketHolding: holdTickets(showtimeId, customerId)
        // Booking <-- TicketHolding: 성공

        // return this.service.holdTickets(showtimeId, customerId, ticketIds, seatHoldExpirationTime)
    }
}
