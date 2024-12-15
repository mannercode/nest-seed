import { Injectable } from '@nestjs/common'
import { ClientProxyService, MethodLog } from 'common'
import { Observable } from 'rxjs'

@Injectable()
export class TicketHoldingService {
    constructor(private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    holdTickets(args: {
        customerId: string
        showtimeId: string
        ticketIds: string[]
        ttlMs: number
    }): Observable<boolean> {
        return this.service.send('holdTickets', args)
    }

    @MethodLog({ level: 'verbose' })
    findHeldTicketIds(showtimeId: string, customerId: string): Observable<string[]> {
        return this.service.send('findHeldTicketIds', { showtimeId, customerId })
    }

    @MethodLog({ level: 'verbose' })
    releaseTickets(showtimeId: string, customerId: string): Observable<boolean> {
        return this.service.send('releaseTickets', { showtimeId, customerId })
    }
}
