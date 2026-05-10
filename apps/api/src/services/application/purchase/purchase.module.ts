import { CacheModule, NatsPubSubModule } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { getProjectId } from 'config'
import { PurchaseRecordsModule, ShowtimesModule, TicketHoldingModule, TicketsModule } from 'core'
import { PaymentsModule } from 'infrastructure'
import { NatsSetupModule, RedisSetupModule } from 'modules'
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
        NatsPubSubModule.register({ natsName: NatsSetupModule.connectionName }),
        CacheModule.register({
            name: 'purchase',
            prefix: `cache:${getProjectId()}`,
            redisName: RedisSetupModule.connectionName
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
