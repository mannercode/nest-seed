import { Injectable } from '@nestjs/common';
import { ClientProxyService, getProxyValue, InjectClientProxy, LatLong, MethodLog } from 'common';
import { TheaterDto, TicketDto } from 'cores';
import { Routes } from 'shared/config';
import { ShowtimeSalesStatusDto } from './dtos';

@Injectable()
export class BookingProxy {
    constructor(@InjectClientProxy('clientProxy') private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    findShowingTheaters(args: { movieId: string; latlong: LatLong }): Promise<TheaterDto[]> {
        return getProxyValue(this.service.send(Routes.Messages.Booking.findShowingTheaters, args))
    }

    @MethodLog({ level: 'verbose' })
    findShowdates(args: { movieId: string; theaterId: string }): Promise<Date[]> {
        return getProxyValue(this.service.send(Routes.Messages.Booking.findShowdates, args))
    }

    @MethodLog({ level: 'verbose' })
    findShowtimes(args: {
        movieId: string
        theaterId: string
        showdate: Date
    }): Promise<ShowtimeSalesStatusDto[]> {
        return getProxyValue(this.service.send(Routes.Messages.Booking.findShowtimes, args))
    }

    @MethodLog({ level: 'verbose' })
    getAvailableTickets(showtimeId: string): Promise<TicketDto[]> {
        return getProxyValue(
            this.service.send(Routes.Messages.Booking.getAvailableTickets, showtimeId)
        )
    }

    @MethodLog({ level: 'verbose' })
    holdTickets(args: { customerId: string; showtimeId: string; ticketIds: string[] }): Promise<{
        heldTicketIds: string[]
    }> {
        return getProxyValue(this.service.send(Routes.Messages.Booking.holdTickets, args))
    }
}
