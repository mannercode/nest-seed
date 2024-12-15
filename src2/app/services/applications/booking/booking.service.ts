import { Injectable } from '@nestjs/common'
import { LatLong, MethodLog, pickIds } from 'common'
import {
    ShowtimesService,
    TheatersService,
    TicketHoldingService,
    TicketsService
} from 'services/cores'
import { generateShowtimesWithSalesStatus, sortTheatersByDistance } from './booking.utils'
import { ShowtimeSalesStatusDto } from './dtos'

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

        const ids = pickIds(showtimes)
        const salesStatuses = await this.ticketsService.getSalesStatuses(ids)

        const showtimesWithSalesStatus = generateShowtimesWithSalesStatus(showtimes, salesStatuses)

        return showtimesWithSalesStatus as ShowtimeSalesStatusDto[]
    }

    @MethodLog({ level: 'verbose' })
    async getAvailableTickets(showtimeId: string) {
        const tickets = await this.ticketsService.findAllTickets({ showtimeIds: [showtimeId] })
        return tickets
    }

    @MethodLog({ level: 'verbose' })
    async holdTickets(args: { customerId: string; showtimeId: string; ticketIds: string[] }) {
        const seatHoldExpirationTime = 10 * 60 * 1000

        await this.ticketHoldingService.holdTickets({ ...args, ttlMs: seatHoldExpirationTime })

        return { heldTicketIds: args.ticketIds }
    }
}
