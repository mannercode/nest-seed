import { Injectable } from '@nestjs/common'
import {
    ClientProxyService,
    getProxyValue,
    InjectClientProxy,
    MethodLog,
    waitProxyValue
} from 'common'
import { PurchaseCreateDto, PurchaseDto } from 'cores'
import { ClientProxyConfig, Messages } from 'shared/config'

@Injectable()
export class PurchaseProcessProxy {
    constructor(
        @InjectClientProxy(ClientProxyConfig.connName) private service: ClientProxyService
    ) {}

    @MethodLog({ level: 'verbose' })
    processPurchase(createDto: PurchaseCreateDto): Promise<PurchaseDto> {
        return getProxyValue(this.service.send(Messages.PurchaseProcess.processPurchase, createDto))
    }

    emitTicketPurchased(customerId: string, ticketIds: string[]) {
        return waitProxyValue(
            this.service.emit(Messages.PurchaseProcess.TicketPurchased, { customerId, ticketIds })
        )
    }

    emitTicketPurchaseCanceled(customerId: string, ticketIds: string[]) {
        return waitProxyValue(
            this.service.emit(Messages.PurchaseProcess.TicketPurchaseCanceled, {
                customerId,
                ticketIds
            })
        )
    }
}
