import { CacheModule } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { getProjectId } from 'config'
import { RedisSetupModule } from 'modules'
import { TicketHoldingService } from './ticket-holding.service'

@Module({
    exports: [TicketHoldingService],
    imports: [
        CacheModule.register({
            name: 'ticket-holding',
            prefix: `cache:${getProjectId()}`,
            redisName: RedisSetupModule.connectionName
        })
    ],
    providers: [TicketHoldingService]
})
export class TicketHoldingModule {}
