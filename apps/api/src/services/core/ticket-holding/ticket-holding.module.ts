import { CacheModule } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { AppConfigService, REDIS_CONNECTION_NAME } from '#config'
import { TicketHoldingService } from './ticket-holding.service.js'

@Module({
    exports: [TicketHoldingService],
    imports: [
        CacheModule.register({
            inject: [AppConfigService],
            name: 'ticket-holding',
            prefix: (config: AppConfigService) => `cache:${config.projectId}`,
            redisName: REDIS_CONNECTION_NAME
        })
    ],
    providers: [TicketHoldingService]
})
export class TicketHoldingModule {}
