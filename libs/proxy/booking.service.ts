import { Injectable } from '@nestjs/common'
import { LatLong, MethodLog } from 'common'
import { ShowtimeSalesStatusDto, TheaterDto, TicketDto } from 'types'

@Injectable()
export class BookingService {
    constructor() {}

    @MethodLog({ level: 'verbose' })
    async findShowingTheaters(args: { movieId: string; latlong: LatLong }): Promise<TheaterDto[]> {
        return []
    }

    @MethodLog({ level: 'verbose' })
    async findShowdates(args: { movieId: string; theaterId: string }): Promise<Date[]> {
        return []
    }

    @MethodLog({ level: 'verbose' })
    async findShowtimes(args: {
        movieId: string
        theaterId: string
        showdate: Date
    }): Promise<ShowtimeSalesStatusDto[]> {
        return []
    }

    @MethodLog({ level: 'verbose' })
    async getAvailableTickets(showtimeId: string): Promise<TicketDto[]> {
        return []
    }

    @MethodLog({ level: 'verbose' })
    async holdTickets(args: {
        customerId: string
        showtimeId: string
        ticketIds: string[]
    }): Promise<{
        heldTicketIds: string[]
    }> {
        return { heldTicketIds: [] }
    }
}
