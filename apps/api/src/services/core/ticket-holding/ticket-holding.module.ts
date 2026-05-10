import { CacheModule } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { getProjectId, REDIS_CONNECTION_NAME } from 'config'
import { TicketHoldingService } from './ticket-holding.service'

@Module({
    exports: [TicketHoldingService],
    imports: [
        CacheModule.register({
            name: 'ticket-holding',
            prefix: `cache:${getProjectId()}`,
            redisName: REDIS_CONNECTION_NAME
        })
    ],
    providers: [TicketHoldingService]
})
export class TicketHoldingModule {}
