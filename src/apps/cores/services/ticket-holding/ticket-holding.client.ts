import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy } from 'common'
import { Messages } from 'shared'
import { HoldTicketsDto } from './dtos'

@Injectable()
export class TicketHoldingClient {
    constructor(@InjectClientProxy() private proxy: ClientProxyService) {}

    holdTickets(holdDto: HoldTicketsDto): Promise<boolean> {
        return this.proxy.getJson(Messages.TicketHolding.holdTickets, holdDto)
    }

    searchHeldTicketIds(showtimeId: string, customerId: string): Promise<string[]> {
        return this.proxy.getJson(Messages.TicketHolding.searchHeldTicketIds, {
            showtimeId,
            customerId
        })
    }

    releaseTickets(showtimeId: string, customerId: string): Promise<boolean> {
        return this.proxy.getJson(Messages.TicketHolding.releaseTickets, { showtimeId, customerId })
    }
}
