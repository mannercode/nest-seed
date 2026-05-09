import { CacheModule } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { AppConfigService, RedisConfigModule } from 'config'
import { TicketHoldingService } from './ticket-holding.service'

@Module({
    exports: [TicketHoldingService],
    imports: [
        CacheModule.register({
            name: 'ticket-holding',
            prefix: `cache:${AppConfigService.projectId}`,
            redisName: RedisConfigModule.connectionName
        })
    ],
    providers: [TicketHoldingService]
})
export class TicketHoldingModule {}
