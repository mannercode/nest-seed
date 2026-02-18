import { Module } from '@nestjs/common'
import { CacheModule } from 'common'
import { getProjectId, RedisConfigModule } from 'shared'
import { TicketHoldingController } from './ticket-holding.controller'
import { TicketHoldingService } from './ticket-holding.service'

@Module({
    controllers: [TicketHoldingController],
    imports: [
        CacheModule.register({
            name: 'ticket-holding',
            prefix: `cache:${getProjectId()}`,
            redisName: RedisConfigModule.connectionName
        })
    ],
    providers: [TicketHoldingService]
})
export class TicketHoldingModule {}
