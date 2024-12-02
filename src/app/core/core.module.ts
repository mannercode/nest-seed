import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { CacheModule, EventModule, generateShortId, JwtAuthModule, RedisModule } from 'common'
import { AppConfigService, isEnv } from 'config'
import Redis from 'ioredis'
import { ConfigModule } from './config.module'
import { HttpModule } from './http.module'
import { LoggerModule } from './logger.module'
import { MongooseModule } from './mongoose.module'
import { MulterModule } from './multer.module'

@Module({
    imports: [
        ConfigModule,
        EventModule,
        HttpModule,
        LoggerModule,
        MongooseModule,
        MulterModule,
        RedisModule.forRootAsync(
            { useFactory: (config: AppConfigService) => config.redis, inject: [AppConfigService] },
            'redis'
        ),
        CacheModule.forRootAsync('cache', {
            useFactory: async (redis: Redis) => ({
                prefix: isEnv('test') ? `cache:${generateShortId()}` : 'cache',
                connection: redis
            }),
            inject: [RedisModule.getToken('redis')]
        }),
        JwtAuthModule.forRootAsync('jwtauth', {
            useFactory: async (redis: Redis) => ({
                prefix: isEnv('test') ? `jwtauth:${generateShortId()}` : 'jwtauth',
                connection: redis
            }),
            inject: [RedisModule.getToken('redis')]
        }),
        BullModule.forRootAsync('queue', {
            useFactory: async (redis: Redis) => ({
                prefix: isEnv('test') ? `{queue:${generateShortId()}}` : '{queue}',
                connection: redis
            }),
            inject: [RedisModule.getToken('redis')]
        })
    ],
    exports: [MulterModule]
})
export class CoreModule {}
