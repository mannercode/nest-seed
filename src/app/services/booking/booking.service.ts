import { Injectable } from '@nestjs/common'
import { LatLong, MethodLog } from 'common'
import { ShowtimesService } from 'services/showtimes'
import { TheatersService } from 'services/theaters'
import { TicketHoldingService } from 'services/ticket-holding'
import { TicketsService } from 'services/tickets'
import { sortTheatersByDistance } from './booking.utils'

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
        const { movieId, theaterId } = args
        // Booking -> Showtimes: findShowdates({movieId, theaterId})
        // Booking <-- Showtimes: showdates[]
        // Backend <-- Booking: showdates[]

        // return this.service.findShowdates(movieId, theaterId)
    }

    @MethodLog({ level: 'verbose' })
    async findShowtimes(args: { movieId: string; theaterId: string; showdate: string }) {
        const { movieId, theaterId, showdate } = args
        // Booking -> Showtimes: findShowtimes({movieId, theaterId, showdate})
        // Booking <-- Showtimes: showtimes[]
        // Booking -> Tickets: getSalesStatuses({ showtimeIds })
        // Booking <-- Tickets: salesStatuses[]
        // note left
        // ShowtimeSalesStatus = {
        //     showtimeId: string
        //     salesStatus:{
        //         total: number
        //         sold: number
        //         available: number
        //     }
        // }
        // end note
        // Booking -> Booking: generateShowtimesWithSalesStatus\n(Showtimes[], salesStatuses)
        // Backend <-- Booking: showtimesWithSalesStatus[]

        // return this.service.findShowtimes(movieId, theaterId, showdate)
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
