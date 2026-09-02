import { CacheModule } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { AppConfigService, REDIS_CONNECTION_NAME } from '#config'
import { PurchaseRecordsModule, ShowtimesModule, TicketHoldingModule, TicketsModule } from '#core'
import { PaymentsModule } from '#infrastructure'
import { PurchaseNotificationService, TicketPurchaseService } from './internal/index.js'
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
        PaymentsModule,
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
        { provide: PURCHASE_EVENTS_MAX_BYTES, useValue: DEFAULT_PURCHASE_EVENTS_MAX_BYTES }
    ]
})
export class PurchaseModule {}
