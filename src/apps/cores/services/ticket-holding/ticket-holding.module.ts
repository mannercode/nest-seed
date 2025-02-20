import { Module } from '@nestjs/common'
import { CacheModule } from 'common'
import { ProjectName, RedisConfig, uniqueWhenTesting } from 'shared/config'
import { TicketHoldingController } from './ticket-holding.controller'
import { TicketHoldingService } from './ticket-holding.service'

@Module({
    imports: [
        CacheModule.register({
            name: 'ticket-holding',
            redisName: RedisConfig.connName,
            prefix: `cache:${uniqueWhenTesting(ProjectName)}`
        })
    ],
    providers: [TicketHoldingService],
    controllers: [TicketHoldingController]
})
export class TicketHoldingModule {}
