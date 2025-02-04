import { Module } from '@nestjs/common'
import { APP_PIPE } from '@nestjs/core'
import { AppValidationPipe } from 'common'
import { ConfigModule } from './config.module'
import { HealthModule } from './health.module'
import { LoggerModule } from './logger.module'
import { MongooseModule } from './mongoose.module'
import { RedisModule } from './redis.module'

@Module({
    imports: [HealthModule, LoggerModule, MongooseModule, RedisModule, ConfigModule],
    providers: [{ provide: APP_PIPE, useClass: AppValidationPipe }]
})
export class Modules {}
