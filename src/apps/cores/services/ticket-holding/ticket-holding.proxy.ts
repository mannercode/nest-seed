import { Injectable } from '@nestjs/common'
import { ClientProxyService, getProxyValue, InjectClientProxy, MethodLog } from 'common'
import { Routes } from 'shared/config'

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
        return getProxyValue(this.service.send(Routes.Messages.TicketHolding.holdTickets, args))
    }

    @MethodLog({ level: 'verbose' })
    findHeldTicketIds(showtimeId: string, customerId: string): Promise<string[]> {
        return getProxyValue(
            this.service.send(Routes.Messages.TicketHolding.findHeldTicketIds, { showtimeId, customerId })
        )
    }
}
