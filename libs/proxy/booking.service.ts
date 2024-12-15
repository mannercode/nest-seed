import { Injectable } from '@nestjs/common'
import { ClientProxyService, LatLong, MethodLog } from 'common'
import { Observable } from 'rxjs'
import { ShowtimeSalesStatusDto, TheaterDto, TicketDto } from 'types'

@Injectable()
export class BookingService {
    constructor(private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    findShowingTheaters(args: { movieId: string; latlong: LatLong }): Observable<TheaterDto[]> {
        return this.service.send('findShowingTheaters', args)
    }

    @MethodLog({ level: 'verbose' })
    findShowdates(args: { movieId: string; theaterId: string }): Observable<Date[]> {
        return this.service.send('findShowdates', args)
    }

    @MethodLog({ level: 'verbose' })
    findShowtimes(args: {
        movieId: string
        theaterId: string
        showdate: Date
    }): Observable<ShowtimeSalesStatusDto[]> {
        return this.service.send('findShowtimes', args)
    }

    @MethodLog({ level: 'verbose' })
    getAvailableTickets(showtimeId: string): Observable<TicketDto[]> {
        return this.service.send('getAvailableTickets', showtimeId)
    }

    @MethodLog({ level: 'verbose' })
    holdTickets(args: { customerId: string; showtimeId: string; ticketIds: string[] }): Observable<{
        heldTicketIds: string[]
    }> {
        return this.service.send('holdTickets', args)
    }
}
