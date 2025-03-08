import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy } from 'common'
import { PurchaseCreateDto, PurchaseDto } from 'cores'
import { ClientProxyConfig, Messages } from 'shared/config'

@Injectable()
export class PurchaseProcessProxy {
    constructor(
        @InjectClientProxy(ClientProxyConfig.connName) private service: ClientProxyService
    ) {}

    processPurchase(createDto: PurchaseCreateDto): Promise<PurchaseDto> {
        return this.service.getJson(Messages.PurchaseProcess.processPurchase, createDto)
    }

    emitTicketPurchased(customerId: string, ticketIds: string[]) {
        return this.service.emit(Messages.PurchaseProcess.TicketPurchased, {
            customerId,
            ticketIds
        })
    }

    emitTicketPurchaseCanceled(customerId: string, ticketIds: string[]) {
        return this.service.emit(Messages.PurchaseProcess.TicketPurchaseCanceled, {
            customerId,
            ticketIds
        })
    }
}
