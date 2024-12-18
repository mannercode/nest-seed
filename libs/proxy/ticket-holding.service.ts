import { Injectable } from '@nestjs/common'
import { ClientProxyService, getProxyValue, MethodLog } from 'common'

@Injectable()
export class TicketHoldingService {
    constructor(private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    holdTickets(args: {
        customerId: string
        showtimeId: string
        ticketIds: string[]
        ttlMs: number
    }): Promise<boolean> {
        return getProxyValue(this.service.send('holdTickets', args))
    }

    @MethodLog({ level: 'verbose' })
    findHeldTicketIds(showtimeId: string, customerId: string): Promise<string[]> {
        return getProxyValue(this.service.send('findHeldTicketIds', { showtimeId, customerId }))
    }

    @MethodLog({ level: 'verbose' })
    releaseTickets(showtimeId: string, customerId: string): Promise<boolean> {
        return getProxyValue(this.service.send('releaseTickets', { showtimeId, customerId }))
    }
}
