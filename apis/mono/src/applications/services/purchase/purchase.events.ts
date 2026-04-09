import { Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'

@Injectable()
export class PurchaseEvents {
    constructor(private readonly eventEmitter: EventEmitter2) {}

    emitTicketPurchaseCanceled(customerId: string, ticketIds: string[]) {
        this.eventEmitter.emit('purchase.ticketPurchaseCanceled', { customerId, ticketIds })
    }

    emitTicketPurchased(customerId: string, ticketIds: string[]) {
        this.eventEmitter.emit('purchase.ticketPurchased', { customerId, ticketIds })
    }
}
