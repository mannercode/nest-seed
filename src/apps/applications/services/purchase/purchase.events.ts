import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy } from 'common'
import { Events } from 'shared'

@Injectable()
export class PurchaseEvents {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    emitTicketPurchased(customerId: string, ticketIds: string[]) {
        return this.proxy.emit(Events.Purchase.ticketPurchased, { customerId, ticketIds })
    }

    emitTicketPurchaseCanceled(customerId: string, ticketIds: string[]) {
        return this.proxy.emit(Events.Purchase.ticketPurchaseCanceled, { customerId, ticketIds })
    }
}
