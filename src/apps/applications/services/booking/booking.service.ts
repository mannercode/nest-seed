import { Injectable } from '@nestjs/common'
import { LatLong, pickIds } from 'common'
import { ShowtimesProxy, TheatersProxy, TicketHoldingProxy, TicketsProxy } from 'cores'
import { generateShowtimesWithSalesStatus, sortTheatersByDistance } from './booking.utils'
import { ShowtimeSalesStatusDto } from './dtos'

@Injectable()
export class BookingService {
    constructor(
        private showtimesService: ShowtimesProxy,
        private theatersService: TheatersProxy,
        private ticketHoldingService: TicketHoldingProxy,
        private ticketsService: TicketsProxy
    ) {}

    async findShowingTheaters(args: { movieId: string; latlong: LatLong }) {
        const { movieId, latlong } = args
        const theaterIds = await this.showtimesService.findTheaterIdsByMovieId(movieId)
        const theaters = await this.theatersService.getTheatersByIds(theaterIds)
        const showingTheaters = sortTheatersByDistance(theaters, latlong)

        return showingTheaters
    }

    async findShowdates(args: { movieId: string; theaterId: string }) {
        return this.showtimesService.findShowdates(args)
    }

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

        const ids = pickIds(showtimes)
        const salesStatuses = await this.ticketsService.getSalesStatuses(ids)

        const showtimesWithSalesStatus = generateShowtimesWithSalesStatus(showtimes, salesStatuses)

        return showtimesWithSalesStatus as ShowtimeSalesStatusDto[]
    }

    async getAvailableTickets(showtimeId: string) {
        const tickets = await this.ticketsService.findAllTickets({ showtimeIds: [showtimeId] })
        return tickets
    }

    async holdTickets(args: { customerId: string; showtimeId: string; ticketIds: string[] }) {
        const seatHoldExpirationTime = 10 * 60 * 1000

        await this.ticketHoldingService.holdTickets({ ...args, ttlMs: seatHoldExpirationTime })

        return { heldTicketIds: args.ticketIds }
    }
}
