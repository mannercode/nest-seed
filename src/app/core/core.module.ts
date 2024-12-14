import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { EventModule, generateShortId, RedisModule } from 'common'
import { AppConfigService, isTest, RedisConfig } from 'config'
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
        EventModule.forRoot(),
        HealthModule,
        HttpModule,
        LoggerModule,
        MongooseModule,
        MulterModule,
        RedisModule.forRootAsync(
            { useFactory: (config: AppConfigService) => config.redis, inject: [AppConfigService] },
            RedisConfig.connName
        ),
        BullModule.forRootAsync('queue', {
            useFactory: async (redis: Redis) => ({
                prefix: isTest() ? `{queue:${generateShortId()}}` : '{queue}',
                connection: redis
            }),
            inject: [RedisModule.getToken(RedisConfig.connName)]
        })
    ],
    exports: [MulterModule, HealthModule]
})
export class CoreModule {}
