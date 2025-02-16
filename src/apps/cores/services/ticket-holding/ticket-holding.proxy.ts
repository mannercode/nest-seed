import { Injectable } from '@nestjs/common'
import { ClientProxyService, getProxyValue, InjectClientProxy, MethodLog } from 'common'

@Injectable()
export class TicketHoldingProxy {
    constructor(@InjectClientProxy('clientProxy') private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    holdTickets(args: {
        customerId: string
        showtimeId: string
        ticketIds: string[]
        ttlMs: number
    }): Promise<boolean> {
        return getProxyValue(this.service.send('cores.ticket-holding.holdTickets', args))
    }

    @MethodLog({ level: 'verbose' })
    findHeldTicketIds(showtimeId: string, customerId: string): Promise<string[]> {
        return getProxyValue(
            this.service.send('cores.ticket-holding.findHeldTicketIds', { showtimeId, customerId })
        )
    }
}
