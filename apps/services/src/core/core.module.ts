import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { generateShortId, RedisModule } from 'common'
import { AppConfigService, isTest, RedisConfig } from 'config'
import Redis from 'ioredis'
import { ConfigModule } from './config.module'
import { LoggerModule } from './logger.module'
import { MongooseModule } from './mongoose.module'

@Module({
    imports: [
        ConfigModule,
        LoggerModule,
        MongooseModule,
        RedisModule.forRootAsync(
            { useFactory: (config: AppConfigService) => config.redis, inject: [AppConfigService] },
            RedisConfig.connName
        ),
        BullModule.forRootAsync('queue', {
            useFactory: async (redis: Redis) => ({
                prefix: isTest() ? `{queue:${generateShortId()}}` : '{queue}',
                connection: redis
            }),
            inject: [RedisModule.getToken(RedisConfig.connName)]
        })
    ]
})
export class CoreModule {}
