import { Module } from '@nestjs/common'
import { BullModule } from './bull.module'
import { ConfigModule } from './config.module'
import { LoggerModule } from './logger.module'
import { MongooseModule } from './mongoose.module'
import { PipesModule } from './pipes.module'
import { RedisModule } from './redis.module'

@Module({
    imports: [ConfigModule, PipesModule, LoggerModule, MongooseModule, RedisModule, BullModule]
})
export class Modules {}
