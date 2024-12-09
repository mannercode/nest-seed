import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { CacheModule, EventModule, generateShortId, JwtAuthModule, RedisModule } from 'common'
import { AppConfigService, isTest } from 'config'
import Redis from 'ioredis'
import { ConfigModule } from './config.module'
import { HealthModule } from './health.module'
import { HttpModule } from './http.module'
import { LoggerModule } from './logger.module'
import { MongooseModule } from './mongoose.module'
import { MulterModule } from './multer.module'

@Module({
    imports: [
        ConfigModule,
        EventModule,
        HealthModule,
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
                prefix: isTest() ? `cache:${generateShortId()}` : 'cache',
                connection: redis
            }),
            inject: [RedisModule.getToken('redis')]
        }),
        JwtAuthModule.forRootAsync('jwtauth', {
            useFactory: async (redis: Redis) => ({
                prefix: isTest() ? `jwtauth:${generateShortId()}` : 'jwtauth',
                connection: redis
            }),
            inject: [RedisModule.getToken('redis')]
        }),
        BullModule.forRootAsync('queue', {
            useFactory: async (redis: Redis) => ({
                prefix: isTest() ? `{queue:${generateShortId()}}` : '{queue}',
                connection: redis
            }),
            inject: [RedisModule.getToken('redis')]
        })
    ],
    exports: [MulterModule, HealthModule]
})
export class CoreModule {}
