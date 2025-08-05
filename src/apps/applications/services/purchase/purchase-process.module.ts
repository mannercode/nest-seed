import { Module } from '@nestjs/common'
import {
    PurchaseRecordsClient,
    ShowtimesClient,
    TicketHoldingClient,
    TicketsClient
} from 'apps/cores'
import { TicketPurchaseProcessor } from './processors'
import { PurchaseProcessClient } from './purchase-process.client'
import { PurchaseProcessController } from './purchase-process.controller'
import { PurchaseProcessEvents } from './purchase-process.events'
import { PurchaseProcessService } from './purchase-process.service'
import { PaymentsClient } from 'apps/infrastructures'

@Module({
    providers: [
        PurchaseProcessService,
        TicketPurchaseProcessor,
        PurchaseProcessClient,
        PurchaseProcessEvents,
        TicketsClient,
        TicketHoldingClient,
        PurchaseRecordsClient,
        ShowtimesClient,
        PaymentsClient
    ],
    controllers: [PurchaseProcessController]
})
export class PurchaseProcessModule {}
