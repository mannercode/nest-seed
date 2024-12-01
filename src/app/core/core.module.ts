import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { CacheModule, EventModule, generateShortId, RedisModule } from 'common'
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
                useFactory: (config: AppConfigService) => ({ ...config.redis, type: 'cluster' }),
                inject: [AppConfigService]
            },
            'redis'
        ),
        CacheModule.forRootAsync(
            {
                useFactory: (redis: Redis) => ({
                    redis,
                    prefix: isEnv('test') ? 'ticket:' + generateShortId() : 'TicketHolding'
                }),
                inject: [RedisModule.getConnectionToken('redis')]
            },
            'TicketHolding'
        ),
        BullModule.forRootAsync('bullmq', {
            useFactory: async (redis: Redis) => {
                return {
                    prefix: isEnv('test') ? `queue:{${generateShortId()}}` : '{queue}',
                    connection: redis
                }
            },
            inject: [RedisModule.getConnectionToken('redis')]
        })
    ],
    exports: [MulterModule]
})
export class CoreModule {}
