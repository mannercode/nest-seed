import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { CacheModule } from './cache.module'
import { ConfigModule } from './config.module'
import { EventModule } from './event.module'
import { HttpModule } from './http.module'
import { LoggerModule } from './logger.module'
import { MongoDbModule } from './mongo.db.module'
import { MulterModule } from './multer.module'
import { QueueModule } from './queue.module'

@Module({
    imports: [
        JwtModule.register({ global: true }),
        CacheModule,
        ConfigModule,
        EventModule,
        HttpModule,
        LoggerModule,
        MongoDbModule,
        QueueModule,
        MulterModule
    ],
    exports: [MulterModule]
})
export class CoreModule {}
