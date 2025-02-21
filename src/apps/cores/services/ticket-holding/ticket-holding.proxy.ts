import { Injectable } from '@nestjs/common'
import { ClientProxyService, getProxyValue, InjectClientProxy, MethodLog } from 'common'
import { ClientProxyConfig, Subjects } from 'shared/config'

@Injectable()
export class TicketHoldingProxy {
    constructor(
        @InjectClientProxy(ClientProxyConfig.connName) private service: ClientProxyService
    ) {}

    @MethodLog({ level: 'verbose' })
    holdTickets(args: {
        customerId: string
        showtimeId: string
        ticketIds: string[]
        ttlMs: number
    }): Promise<boolean> {
        return getProxyValue(this.service.send(Subjects.TicketHolding.holdTickets, args))
    }

    @MethodLog({ level: 'verbose' })
    findHeldTicketIds(showtimeId: string, customerId: string): Promise<string[]> {
        return getProxyValue(
            this.service.send(Subjects.TicketHolding.findHeldTicketIds, { showtimeId, customerId })
        )
    }
}
