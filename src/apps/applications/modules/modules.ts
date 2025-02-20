import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { APP_PIPE } from '@nestjs/core'
import { AppValidationPipe, RedisModule } from 'common'
import Redis from 'ioredis'
import { AppConfigService, ProjectName, RedisConfig, uniqueWhenTesting } from 'shared/config'
import { ClientProxiesModule } from './client-proxies.module'
import { ConfigModule } from './config.module'
import { HealthModule } from './health.module'
import { LoggerModule } from './logger.module'

@Module({
    imports: [
        HealthModule,
        LoggerModule,
        RedisModule.forRootAsync(
            {
                useFactory: (config: AppConfigService) => config.redis,
                inject: [AppConfigService]
            },
            RedisConfig.connName
        ),
        BullModule.forRootAsync('queue', {
            useFactory: (redis: Redis) => ({
                prefix: `{queue:${uniqueWhenTesting(ProjectName)}}`,
                connection: redis
            }),
            inject: [RedisModule.getToken(RedisConfig.connName)]
        }),
        ConfigModule,
        ClientProxiesModule
    ],
    providers: [{ provide: APP_PIPE, useClass: AppValidationPipe }]
})
export class Modules {}
