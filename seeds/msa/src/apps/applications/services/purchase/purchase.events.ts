import { ClientProxyService } from '@mannercode/microservice'
import { InjectClientProxy } from '@mannercode/microservice'
import { Injectable } from '@nestjs/common'
import { Events } from 'config'

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
