import { CACHE_MANAGER, CacheModule as NestCacheModule } from '@nestjs/cache-manager'
import { Global, Inject, Injectable, Module, OnModuleDestroy } from '@nestjs/common'
import { Cache } from 'cache-manager'
import { redisStore } from 'cache-manager-ioredis-yet'
import { AppConfigService } from 'config'

@Injectable()
export class CacheDisconnectService implements OnModuleDestroy {
    constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

    onModuleDestroy() {
        const client = (this.cacheManager.store as any).client
        client?.disconnect()
    }
}

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
    providers: [CacheDisconnectService],
    exports: [NestCacheModule]
})
export class CacheModule {}
