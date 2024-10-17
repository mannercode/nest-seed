import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { MulterModule } from '@nestjs/platform-express'
import { CacheModule } from './cache.module'
import { ConfigModule } from './config.module'
import { EventModule } from './event.module'
import { HttpModule } from './http.module'
import { LoggerModule } from './logger.module'
import { MongoDbModule } from './mongo.db.module'
import { QueueModule } from './queue.module'

@Module({
    imports: [
        JwtModule.register({ global: true }),
        MulterModule,
        CacheModule,
        ConfigModule,
        EventModule,
        HttpModule,
        LoggerModule,
        MongoDbModule,
        QueueModule
    ]
})
export class CoreModule {}
