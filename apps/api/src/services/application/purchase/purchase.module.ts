import { Module } from '@nestjs/common'
import { PurchaseRecordsModule, ShowtimesModule, TicketHoldingModule, TicketsModule } from '#core'
import { PaymentsModule } from '#infrastructure'
import {
    PurchaseNotificationService,
    PurchaseTransactionRepository,
    TicketPurchaseService
} from './internal/index.js'
import {
    DEFAULT_PURCHASE_EVENTS_MAX_BYTES,
    PURCHASE_EVENTS_MAX_BYTES,
    PurchaseEvents
} from './purchase.events.js'
import { PurchaseService } from './purchase.service.js'

@Module({
    exports: [PurchaseService],
    imports: [
        TicketsModule,
        TicketHoldingModule,
        PurchaseRecordsModule,
        ShowtimesModule,
        PaymentsModule
    ],
    providers: [
        PurchaseService,
        TicketPurchaseService,
        PurchaseEvents,
        PurchaseNotificationService,
        PurchaseTransactionRepository,
        { provide: PURCHASE_EVENTS_MAX_BYTES, useValue: DEFAULT_PURCHASE_EVENTS_MAX_BYTES }
    ]
})
export class PurchaseModule {}
