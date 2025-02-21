import { Injectable } from '@nestjs/common'
import { ClientProxyService, getProxyValue, InjectClientProxy, LatLong, MethodLog } from 'common'
import { TheaterDto, TicketDto } from 'cores'
import { ClientProxyConfig, Subjects } from 'shared/config'
import { ShowtimeSalesStatusDto } from './dtos'

@Injectable()
export class BookingProxy {
    constructor(
        @InjectClientProxy(ClientProxyConfig.connName) private service: ClientProxyService
    ) {}

    @MethodLog({ level: 'verbose' })
    findShowingTheaters(args: { movieId: string; latlong: LatLong }): Promise<TheaterDto[]> {
        return getProxyValue(this.service.send(Subjects.Booking.findShowingTheaters, args))
    }

    @MethodLog({ level: 'verbose' })
    findShowdates(args: { movieId: string; theaterId: string }): Promise<Date[]> {
        return getProxyValue(this.service.send(Subjects.Booking.findShowdates, args))
    }

    @MethodLog({ level: 'verbose' })
    findShowtimes(args: {
        movieId: string
        theaterId: string
        showdate: Date
    }): Promise<ShowtimeSalesStatusDto[]> {
        return getProxyValue(this.service.send(Subjects.Booking.findShowtimes, args))
    }

    @MethodLog({ level: 'verbose' })
    getAvailableTickets(showtimeId: string): Promise<TicketDto[]> {
        return getProxyValue(this.service.send(Subjects.Booking.getAvailableTickets, showtimeId))
    }

    @MethodLog({ level: 'verbose' })
    holdTickets(args: { customerId: string; showtimeId: string; ticketIds: string[] }): Promise<{
        heldTicketIds: string[]
    }> {
        return getProxyValue(this.service.send(Subjects.Booking.holdTickets, args))
    }
}
