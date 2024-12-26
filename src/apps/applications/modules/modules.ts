import { Module } from '@nestjs/common'
import { APP_PIPE } from '@nestjs/core'
import { AppValidationPipe } from 'common'
import { BullModule } from './bull.module'
import { ClientProxiesModule } from './client-proxies.module'
import { ConfigModule } from './config.module'
import { HealthModule } from './health.module'
import { LoggerModule } from './logger.module'
import { RedisModule } from './redis.module'

@Module({
    imports: [
        HealthModule,
        LoggerModule,
        RedisModule,
        BullModule,
        ConfigModule,
        ClientProxiesModule
    ],
    providers: [{ provide: APP_PIPE, useClass: AppValidationPipe }]
})
export class Modules {}
