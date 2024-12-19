import { BullModule as NestedBullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { generateShortId, RedisModule } from 'common'
import Redis from 'ioredis'
import { isTest, RedisConfig } from '../config'

@Module({
    imports: [
        NestedBullModule.forRootAsync('queue', {
            useFactory: async (redis: Redis) => ({
                prefix: isTest() ? `{queue:${generateShortId()}}` : '{queue}',
                connection: redis
            }),
            inject: [RedisModule.getToken(RedisConfig.connName)]
        })
    ]
})
export class BullModule {}
