import { Module } from '@nestjs/common'
import { TicketHoldingService } from './ticket-holding.service'
import { CacheModule, generateShortId, RedisModule } from 'common'
import { isEnv } from 'config'
import Redis from 'ioredis'

@Module({
    imports: [
        CacheModule.forRootAsync(
            {
                useFactory: (redis: Redis) => ({
                    redis,
                    prefix: isEnv('test') ? 'ticket-holding:' + generateShortId() : 'ticket-holding'
                }),
                inject: [RedisModule.getToken('redis')]
            },
            'ticket-holding'
        )
    ],
    providers: [TicketHoldingService],
    exports: [TicketHoldingService]
})
export class TicketHoldingModule {}
