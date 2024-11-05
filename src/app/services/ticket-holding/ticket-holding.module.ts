import { Module } from '@nestjs/common'
import { CacheModule, generateUUID } from 'common'
import { AppConfigService, isEnv } from 'config'
import { TicketHoldingService } from './ticket-holding.service'

@Module({
    imports: [
        CacheModule.forRootAsync(
            {
                useFactory: (config: AppConfigService) => ({
                    type: 'cluster',
                    nodes: config.redis.nodes,
                    prefix: isEnv('test') ? 'ticket:' + generateUUID() : 'TicketHolding'
                }),
                inject: [AppConfigService]
            },
            'TicketHolding'
        )
    ],
    providers: [TicketHoldingService],
    exports: [TicketHoldingService]
})
export class TicketHoldingModule {}
