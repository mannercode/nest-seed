import { Injectable } from '@nestjs/common'
import { ClientProxyService } from 'common'
import { InjectClientProxy } from 'common'
import { Events } from 'shared'

@Injectable()
export class PurchaseEvents {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    emitTicketPurchaseCanceled(customerId: string, ticketIds: string[]) {
        return this.proxy.emit(Events.Purchase.ticketPurchaseCanceled, { customerId, ticketIds })
    }

    emitTicketPurchased(customerId: string, ticketIds: string[]) {
        return this.proxy.emit(Events.Purchase.ticketPurchased, { customerId, ticketIds })
    }
}
