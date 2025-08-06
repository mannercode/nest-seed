import { Module } from '@nestjs/common'
import {
    PurchaseRecordsClient,
    ShowtimesClient,
    TicketHoldingClient,
    TicketsClient
} from 'apps/cores'
import { PaymentsClient } from 'apps/infrastructures'
import { TicketPurchasService } from './services'
import { PurchaseClient } from './purchase.client'
import { PurchaseController } from './purchase.controller'
import { PurchaseEvents } from './purchase.events'
import { PurchaseService } from './purchase.service'

@Module({
    providers: [
        PurchaseService,
        TicketPurchasService,
        PurchaseClient,
        PurchaseEvents,
        TicketsClient,
        TicketHoldingClient,
        PurchaseRecordsClient,
        ShowtimesClient,
        PaymentsClient
    ],
    controllers: [PurchaseController]
})
export class PurchaseModule {}
