import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { EventModule, generateShortId, RedisModule } from 'common'
import { AppConfigService, isEnv } from 'config'
import Redis from 'ioredis'
import { ConfigModule } from './config.module'
import { HttpModule } from './http.module'
import { LoggerModule } from './logger.module'
import { MongoDbModule } from './mongo.db.module'
import { MulterModule } from './multer.module'

@Module({
    imports: [
        ConfigModule,
        EventModule,
        HttpModule,
        LoggerModule,
        MongoDbModule,
        MulterModule,
        RedisModule.forRootAsync(
            {
                useFactory: (config: AppConfigService) => config.redis,
                inject: [AppConfigService]
            },
            'redis'
        ),
        BullModule.forRootAsync('queue', {
            useFactory: async (redis: Redis) => {
                return {
                    prefix: isEnv('test') ? `queue:{${generateShortId()}}` : '{queue}',
                    connection: redis
                }
            },
            inject: [RedisModule.getToken('redis')]
        })
    ],
    exports: [MulterModule]
})
export class CoreModule {}
