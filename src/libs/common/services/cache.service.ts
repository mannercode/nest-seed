import { CACHE_MANAGER, CacheModule as NestCacheModule } from '@nestjs/cache-manager'
import { DynamicModule, Inject, Injectable, Module, OnModuleDestroy } from '@nestjs/common'
import { Cache } from 'cache-manager'
import { redisStore } from 'cache-manager-ioredis-yet'
import { Exception } from 'common'

@Injectable()
export class CacheService {
    constructor(
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        @Inject('PREFIX') private prefix?: string
    ) {}

    private makeKey(key: string) {
        return this.prefix ? `${this.prefix}:${key}` : key
    }

    async set(key: string, value: unknown, expireMillisecs = 0) {
        if (expireMillisecs < 0) {
            throw new Exception('ttlMiliseconds should not be negative')
        }

        await this.cacheManager.set(this.makeKey(key), value, expireMillisecs)
    }

    async get<T>(key: string): Promise<T | undefined> {
        return this.cacheManager.get(this.makeKey(key))
    }

    async delete(key: string) {
        await this.cacheManager.del(this.makeKey(key))
    }
}

@Injectable()
class CacheConnectionService implements OnModuleDestroy {
    constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

    async onModuleDestroy() {
        const client = (this.cacheManager.store as any).client
        await client?.disconnect()
    }
}

export interface CacheModuleOptions {
    prefix?: string
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
                {
                    provide: 'PREFIX',
                    useFactory: async (...args: any[]) => {
                        const cacheOptions = options.useFactory(...args)
                        return cacheOptions.prefix
                    },
                    inject: options.inject
                }
            ],
            exports: [CacheService]
        }
    }
}
