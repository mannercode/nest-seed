import { CacheModule } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { getProjectId, RedisConfigModule } from 'common'
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
