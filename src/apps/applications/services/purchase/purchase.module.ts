import { Module } from '@nestjs/common'
import {
    PurchaseRecordsClient,
    ShowtimesClient,
    TicketHoldingClient,
    TicketsClient
} from 'apps/cores'
import { PaymentsClient } from 'apps/infrastructures'
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
    ]
})
export class PurchaseModule {}
