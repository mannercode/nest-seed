import { Module } from '@nestjs/common'
import { BullModule } from './bull.module'
import { ConfigModule } from './config.module'
import { LoggerModule } from './logger.module'
import { RedisModule } from './redis.module'
import { ClientProxiesModule } from './client-proxies.module'

@Module({
    imports: [LoggerModule, RedisModule, BullModule, ConfigModule, ClientProxiesModule]
})
export class Modules {}
