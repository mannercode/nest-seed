import { Module } from '@nestjs/common'
import { ClientProxiesModule } from './client-proxies.module'
import { ConfigModule } from './config.module'
import { LoggerModule } from './logger.module'
import { MongooseModule } from './mongoose.module'
import { RedisModule } from './redis.module'
import { APP_PIPE } from '@nestjs/core'
import { AppValidationPipe } from 'common'

@Module({
    imports: [LoggerModule, MongooseModule, RedisModule, ConfigModule, ClientProxiesModule],
    providers: [{ provide: APP_PIPE, useClass: AppValidationPipe }]
})
export class Modules {}
