import { Module } from '@nestjs/common'
import { CacheModule, generateShortId } from 'common'
import { isTest, RedisConfig } from 'config'
import { TicketHoldingService } from './ticket-holding.service'

@Module({
    imports: [
        CacheModule.register({
            name: 'ticket-holding',
            redisName: RedisConfig.connName,
            useFactory: () => ({
                prefix: isTest() ? `cache:${generateShortId()}` : 'cache'
            })
        })
    ],
    providers: [TicketHoldingService],
    exports: [TicketHoldingService]
})
export class TicketHoldingModule {}
