import { Injectable } from '@nestjs/common'
import { ClientProxyService } from 'common'
import { InjectClientProxy } from 'common'
import { Messages } from 'shared'
import { HoldTicketsDto } from './dtos'

@Injectable()
export class TicketHoldingClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    holdTickets(holdDto: HoldTicketsDto): Promise<boolean> {
        return this.proxy.request(Messages.TicketHolding.holdTickets, holdDto)
    }

    async releaseTickets(showtimeId: string, customerId: string): Promise<void> {
        await this.proxy.request(Messages.TicketHolding.releaseTickets, { customerId, showtimeId })
    }

    searchHeldTicketIds(showtimeId: string, customerId: string): Promise<string[]> {
        return this.proxy.request(Messages.TicketHolding.searchHeldTicketIds, {
            customerId,
            showtimeId
        })
    }
}
