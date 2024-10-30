import { Module } from '@nestjs/common'
import { CacheModule, generateUUID } from 'common'
import { AppConfigService, isEnv } from 'config'
import { TicketHoldingService } from './ticket-holding.service'

@Module({
    imports: [
        CacheModule.forRootAsync({
            useFactory: (configService: AppConfigService) => ({
                ...configService.ticketHolding,
                prefix: isEnv('test') ? 'test:' + generateUUID() : 'TicketHolding'
            }),
            inject: [AppConfigService]
        })
    ],
    providers: [TicketHoldingService],
    exports: [TicketHoldingService]
})
export class TicketHoldingModule {}
