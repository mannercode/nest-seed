import { Module } from '@nestjs/common'
import { APP_PIPE } from '@nestjs/core'
import { AppValidationPipe } from 'common'
import { ClientProxiesModule } from './client-proxies.module'
import { ConfigModule } from './config.module'
import { HealthModule } from './health.module'
import { LoggerModule } from './logger.module'
import { MongooseModule } from './mongoose.module'
import { RedisModule } from './redis.module'

@Module({
    imports: [
        HealthModule,
        LoggerModule,
        MongooseModule,
        RedisModule,
        ConfigModule,
        ClientProxiesModule
    ],
    providers: [{ provide: APP_PIPE, useClass: AppValidationPipe }]
})
export class Modules {}
