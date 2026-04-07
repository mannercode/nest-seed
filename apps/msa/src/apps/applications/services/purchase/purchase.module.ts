import { Module } from '@nestjs/common'
import { PurchaseRecordsClient, ShowtimesClient, TicketHoldingClient, TicketsClient } from 'cores'
import { PaymentsClient } from 'infrastructures'
import { PurchaseEvents } from './purchase.events'
import { PurchaseHttpController } from './purchase.http-controller'
import { PurchaseService } from './purchase.service'
import { TicketPurchaseService } from './services'

@Module({
    controllers: [PurchaseHttpController],
    providers: [
        PurchaseService,
        TicketPurchaseService,
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
