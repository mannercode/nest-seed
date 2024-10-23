import { CacheModule as NestCacheModule } from '@nestjs/cache-manager'
import { Global, Module } from '@nestjs/common'
import { redisStore } from 'cache-manager-ioredis-yet'
import { CacheService } from 'common'
import { AppConfigService } from 'config'

@Global()
@Module({
    imports: [
        NestCacheModule.registerAsync({
            useFactory: async (config: AppConfigService) => {
                return { ...config.redis, store: redisStore }
            },
            inject: [AppConfigService]
        })
    ],
    providers: [CacheService],
    exports: [CacheService]
})
export class CacheModule {}
