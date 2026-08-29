import { CacheModule, NatsPubSubModule } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { AppConfigService, NATS_CONNECTION_NAME, REDIS_CONNECTION_NAME } from '#config'
import { PurchaseRecordsModule, ShowtimesModule, TicketHoldingModule, TicketsModule } from '#core'
import { PaymentsModule } from '#infrastructure'
import {
    PurchaseEventLoggerService,
    PurchaseNotificationService,
    TicketPurchaseService
} from './internal/index.js'
import { PurchaseEvents } from './purchase.events.js'
import { PurchaseService } from './purchase.service.js'

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
            inject: [AppConfigService],
            name: 'purchase',
            prefix: (config: AppConfigService) => `cache:${config.projectId}`,
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
