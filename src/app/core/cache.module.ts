import { CacheModule as NestCacheModule } from '@nestjs/cache-manager'
import { Global, Module } from '@nestjs/common'
import { redisStore } from 'cache-manager-ioredis-yet'
import { CacheService } from 'common'
import { Config } from 'config'

@Global()
@Module({
    imports: [
        NestCacheModule.registerAsync({
            isGlobal: true,
            useFactory: async () => {
                return {
                    ...Config.redis,
                    store: redisStore
                }
            }
        })
    ],
    providers: [CacheService],
    exports: [CacheService]
})
export class CacheModule {}
