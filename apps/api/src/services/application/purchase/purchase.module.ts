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
    PurchaseEventService
} from './purchase-event.service.js'
import { PurchaseService } from './purchase.service.js'
import { PurchaseWorkflow } from './worker/workflow.js'
import { PurchaseWorkflowClient } from './worker/workflow-client.js'
import { PurchaseEventWorkflow } from './worker/event-workflow.js'
import { PurchaseEventWorkflowClient } from './worker/event-workflow-client.js'

@Module({
    exports: [PurchaseService, PurchaseWorkflow, PurchaseEventWorkflow],
    imports: [
        TicketsModule,
        TicketHoldingModule,
        PurchaseRecordsModule,
        ShowtimesModule,
        PaymentsModule
    ],
    providers: [
        PurchaseService,
        PurchaseWorkflow,
        PurchaseWorkflowClient,
        PurchaseEventWorkflow,
        PurchaseEventWorkflowClient,
        TicketPurchaseService,
        PurchaseEventService,
        PurchaseNotificationService,
        PurchaseTransactionRepository,
        { provide: PURCHASE_EVENTS_MAX_BYTES, useValue: DEFAULT_PURCHASE_EVENTS_MAX_BYTES }
    ]
})
export class PurchaseModule {}
