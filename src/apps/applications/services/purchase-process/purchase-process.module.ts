import { Module } from '@nestjs/common'
import { PurchasesProxy, ShowtimesProxy, TicketHoldingProxy, TicketsProxy } from 'cores'
import { TicketPurchaseProcessor } from './processors'
import { PurchaseProcessController } from './purchase-process.controller'
import { PurchaseProcessService } from './purchase-process.service'

@Module({
    providers: [
        PurchaseProcessService,
        TicketPurchaseProcessor,
        TicketsProxy,
        TicketHoldingProxy,
        PurchasesProxy,
        ShowtimesProxy
    ],
    controllers: [PurchaseProcessController]
})
export class PurchaseProcessModule {}
