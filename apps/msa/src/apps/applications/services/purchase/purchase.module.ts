import { Module } from '@nestjs/common'
import { PurchaseRecordsClient, ShowtimesClient, TicketHoldingClient, TicketsClient } from 'cores'
import { PaymentsClient } from 'infrastructures'
import { PurchaseClient } from './purchase.client'
import { PurchaseController } from './purchase.controller'
import { PurchaseEvents } from './purchase.events'
import { PurchaseService } from './purchase.service'
import { TicketPurchaseService } from './services'

@Module({
    controllers: [PurchaseController],
    providers: [
        PurchaseService,
        TicketPurchaseService,
        PurchaseClient,
        PurchaseEvents,
        TicketsClient,
        TicketHoldingClient,
        PurchaseRecordsClient,
        ShowtimesClient,
        PaymentsClient
    ],
    exports: [TicketPurchaseService, PaymentsClient, PurchaseRecordsClient]
})
export class PurchaseModule {}
