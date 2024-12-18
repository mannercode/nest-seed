import { Injectable } from '@nestjs/common'
import { ClientProxyService, getProxyValue, LatLong, MethodLog } from 'common'
import { ShowtimeSalesStatusDto, TheaterDto, TicketDto } from 'types'

@Injectable()
export class BookingService {
    constructor(private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    findShowingTheaters(args: { movieId: string; latlong: LatLong }): Promise<TheaterDto[]> {
        return getProxyValue(this.service.send('booking.findShowingTheaters', args))
    }

    @MethodLog({ level: 'verbose' })
    findShowdates(args: { movieId: string; theaterId: string }): Promise<Date[]> {
        return getProxyValue(this.service.send('booking.findShowdates', args))
    }

    @MethodLog({ level: 'verbose' })
    findShowtimes(args: {
        movieId: string
        theaterId: string
        showdate: Date
    }): Promise<ShowtimeSalesStatusDto[]> {
        return getProxyValue(this.service.send('booking.findShowtimes', args))
    }

    @MethodLog({ level: 'verbose' })
    getAvailableTickets(showtimeId: string): Promise<TicketDto[]> {
        return getProxyValue(this.service.send('booking.getAvailableTickets', showtimeId))
    }

    @MethodLog({ level: 'verbose' })
    holdTickets(args: { customerId: string; showtimeId: string; ticketIds: string[] }): Promise<{
        heldTicketIds: string[]
    }> {
        return getProxyValue(this.service.send('booking.holdTickets', args))
    }
}
