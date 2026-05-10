import { CacheModule, NatsPubSubModule } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { getProjectId, NATS_CONNECTION_NAME, REDIS_CONNECTION_NAME } from 'config'
import { PurchaseRecordsModule, ShowtimesModule, TicketHoldingModule, TicketsModule } from 'core'
import { PaymentsModule } from 'infrastructure'
import {
    PurchaseEventLoggerService,
    PurchaseNotificationService,
    TicketPurchaseService
} from './internal'
import { PurchaseEvents } from './purchase.events'
import { PurchaseService } from './purchase.service'

@Module({
    exports: [PurchaseService],
    imports: [
        TicketsModule,
        TicketHoldingModule,
        PurchaseRecordsModule,
        ShowtimesModule,
        PaymentsModule,
        NatsPubSubModule.register({ natsName: NATS_CONNECTION_NAME }),
        CacheModule.register({
            name: 'purchase',
            prefix: `cache:${getProjectId()}`,
            redisName: REDIS_CONNECTION_NAME
        })
    ],
    providers: [
        PurchaseService,
        TicketPurchaseService,
        PurchaseEvents,
        PurchaseNotificationService,
        PurchaseEventLoggerService
    ]
})
export class PurchaseModule {}
