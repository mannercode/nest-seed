import { Module } from '@nestjs/common'
import { ConfigModule } from './config.module'
import { LoggerModule } from './logger.module'
import { MongooseModule } from './mongoose.module'
import { RedisModule } from './redis.module'

@Module({
    imports: [LoggerModule, MongooseModule, RedisModule, ConfigModule]
})
export class Modules {}
