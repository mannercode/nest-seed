import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy, MethodLog } from 'common'
import { ClientProxyConfig, Messages } from 'shared/config'

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
        return this.service.getJson(Messages.TicketHolding.holdTickets, args)
    }

    @MethodLog({ level: 'verbose' })
    findHeldTicketIds(showtimeId: string, customerId: string): Promise<string[]> {
        return this.service.getJson(Messages.TicketHolding.findHeldTicketIds, {
            showtimeId,
            customerId
        })
    }
}
