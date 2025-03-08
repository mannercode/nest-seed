import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy, LatLong, MethodLog } from 'common'
import { TheaterDto, TicketDto } from 'cores'
import { ClientProxyConfig, Messages } from 'shared/config'
import { ShowtimeSalesStatusDto } from './dtos'

@Injectable()
export class BookingProxy {
    constructor(
        @InjectClientProxy(ClientProxyConfig.connName) private service: ClientProxyService
    ) {}

    @MethodLog({ level: 'verbose' })
    findShowingTheaters(args: { movieId: string; latlong: LatLong }): Promise<TheaterDto[]> {
        return this.service.getJson(Messages.Booking.findShowingTheaters, args)
    }

    @MethodLog({ level: 'verbose' })
    findShowdates(args: { movieId: string; theaterId: string }): Promise<Date[]> {
        return this.service.getJson(Messages.Booking.findShowdates, args)
    }

    @MethodLog({ level: 'verbose' })
    findShowtimes(args: {
        movieId: string
        theaterId: string
        showdate: Date
    }): Promise<ShowtimeSalesStatusDto[]> {
        return this.service.getJson(Messages.Booking.findShowtimes, args)
    }

    @MethodLog({ level: 'verbose' })
    getAvailableTickets(showtimeId: string): Promise<TicketDto[]> {
        return this.service.getJson(Messages.Booking.getAvailableTickets, showtimeId)
    }

    @MethodLog({ level: 'verbose' })
    holdTickets(args: { customerId: string; showtimeId: string; ticketIds: string[] }): Promise<{
        heldTicketIds: string[]
    }> {
        return this.service.getJson(Messages.Booking.holdTickets, args)
    }
}
