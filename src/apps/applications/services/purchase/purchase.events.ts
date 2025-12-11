import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy } from 'common'
import { Events } from 'shared'

@Injectable()
export class PurchaseEvents {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    emitTicketPurchased(customerId: string, ticketIds: string[]) {
        return this.proxy.emit(Events.Purchase.TicketPurchased, { customerId, ticketIds })
    }

    emitTicketPurchaseCanceled(customerId: string, ticketIds: string[]) {
        return this.proxy.emit(Events.Purchase.TicketPurchaseCanceled, { customerId, ticketIds })
    }
}
