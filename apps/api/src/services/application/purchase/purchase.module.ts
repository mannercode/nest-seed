import { CacheModule } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { AppConfigService, REDIS_CONNECTION_NAME } from '#config'
import { PurchaseRecordsModule, ShowtimesModule, TicketHoldingModule, TicketsModule } from '#core'
import { PaymentsModule } from '#infrastructure'
import { PurchaseNotificationService, TicketPurchaseService } from './internal/index.js'
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
        CacheModule.register({
            inject: [AppConfigService],
            name: 'purchase',
            prefix: (config: AppConfigService) => `cache:${config.projectId}`,
            redisName: REDIS_CONNECTION_NAME
        })
    ],
    providers: [PurchaseService, TicketPurchaseService, PurchaseEvents, PurchaseNotificationService]
})
export class PurchaseModule {}
