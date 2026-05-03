import { CacheModule, NatsPubSubModule } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { getProjectId, NatsConfigModule, RedisConfigModule } from 'config'
import { PurchaseRecordsModule, ShowtimesModule, TicketHoldingModule, TicketsModule } from 'cores'
import { PaymentsModule } from 'infrastructures'
import { PurchaseEvents } from './purchase.events'
import { PurchaseService } from './purchase.service'
import {
    PurchaseEventLoggerService,
    PurchaseNotificationService,
    TicketPurchaseService
} from './services'

@Module({
    exports: [PurchaseService],
    imports: [
        TicketsModule,
        TicketHoldingModule,
        PurchaseRecordsModule,
        ShowtimesModule,
        PaymentsModule,
        NatsPubSubModule.register({ natsName: NatsConfigModule.connectionName }),
        CacheModule.register({
            name: 'purchase',
            prefix: `cache:${getProjectId()}`,
            redisName: RedisConfigModule.connectionName
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
