import { CACHE_MANAGER, CacheModule as NestCacheModule } from '@nestjs/cache-manager'
import { DynamicModule, Inject, Injectable, Module, OnModuleDestroy } from '@nestjs/common'
import { Cache } from 'cache-manager'
import { redisStore } from 'cache-manager-ioredis-yet'
import { Exception, generateUUID } from 'common'

@Injectable()
export class CacheService {
    constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

    async set(key: string, value: unknown, expireMillisecs = 0) {
        if (expireMillisecs < 0) {
            throw new Exception('ttlMiliseconds should not be negative')
        }

        await this.cacheManager.set(key, value, expireMillisecs)
    }

    async get<T>(key: string): Promise<T | undefined> {
        return this.cacheManager.get(key)
    }

    async delete(key: string) {
        await this.cacheManager.del(key)
    }
}

@Injectable()
export class CacheConnectionService implements OnModuleDestroy {
    constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

    async flushAll() {
        const client = (this.cacheManager.store as any).client
        await client?.flushall()
    }

    async onModuleDestroy() {
        const client = (this.cacheManager.store as any).client
        await client?.disconnect()
    }
}

export interface CacheModuleOptions {
    host: string
    port: number
}

@Module({})
export class CacheModule {
    static forRootAsync(options: {
        useFactory: (...args: any[]) => CacheModuleOptions
        inject?: any[]
    }): DynamicModule {
        return {
            module: CacheModule,
            imports: [
                NestCacheModule.registerAsync({
                    useFactory: async (...args: any[]) => {
                        const cacheOptions = options.useFactory(...args)
                        return { ...cacheOptions, store: redisStore }
                    },
                    inject: options.inject
                })
            ],
            providers: [
                CacheService,
                CacheConnectionService,
                /**
                 * 고유한 값을 가지지 않으면 아래 코드를 실행했을 때 1개의 인스턴스만 반환한다
                 * testContext.module.get(CacheDisconnectService, { each: true })
                 */
                { provide: 'MODULE_UNIQUE_ID', useValue: generateUUID() }
            ],
            exports: [CacheService]
        }
    }
}
