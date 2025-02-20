import { BullModule as NestBullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { RedisModule } from 'common'
import Redis from 'ioredis'
import { ProjectName, RedisConfig, uniqueWhenTesting } from 'shared/config'

@Module({
    imports: [
        NestBullModule.forRootAsync('queue', {
            useFactory: (redis: Redis) => ({
                prefix: `{queue:${uniqueWhenTesting(ProjectName)}}`,
                connection: redis
            }),
            inject: [RedisModule.getToken(RedisConfig.connName)]
        })
    ]
})
export class BullModule {}
