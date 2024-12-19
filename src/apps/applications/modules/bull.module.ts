import { Module } from '@nestjs/common'
import { generateShortId, BullModule as OrgBullModule, RedisModule } from 'common'
import Redis from 'ioredis'
import { isTest, RedisConfig } from '../config'

@Module({
    imports: [
        OrgBullModule.forRootAsync('queue', {
            useFactory: async (redis: Redis) => ({
                prefix: isTest() ? `{queue:${generateShortId()}}` : '{queue}',
                connection: redis
            }),
            inject: [RedisModule.getToken(RedisConfig.connName)]
        })
    ]
})
export class BullModule {}
