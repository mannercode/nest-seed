import { DynamicModule, Global, Inject, Injectable, Module } from '@nestjs/common'
import { Exception } from 'common'
import Redis from 'ioredis'

@Injectable()
export class CacheService {
    constructor(
        private readonly redis: Redis,
        private readonly prefix: string
    ) {}

    static getToken(name: string) {
        return `CacheService_${name}`
    }

    private getKey(key: string) {
        return `${this.prefix}:${key}`
    }

    async set(key: string, value: string, ttlMs = 0) {
        if (ttlMs < 0) {
            throw new Exception('TTL must not be negative')
        }

        if (0 < ttlMs) {
            await this.redis.set(this.getKey(key), value, 'PX', ttlMs)
        } else {
            await this.redis.set(this.getKey(key), value)
        }
    }

    async get(key: string): Promise<string | null> {
        const value = await this.redis.get(this.getKey(key))
        return value
    }

    async delete(key: string) {
        await this.redis.del(this.getKey(key))
    }

    async executeScript(script: string, keys: string[], args: string[]): Promise<any> {
        const result = await this.redis.eval(
            script,
            keys.length,
            ...keys.map(this.getKey.bind(this)),
            this.prefix,
            ...args
        )
        return result
    }
}

/* istanbul ignore next */
export function InjectCache(name: string): ParameterDecorator {
    return Inject(CacheService.getToken(name))
}

export type CacheModuleOptions = { connection: Redis; prefix: string }

@Global()
@Module({})
export class CacheModule {
    static getRedisToken(name: string) {
        return `CACHE_REDIS_${name}`
    }

    static getPrefixToken(name: string) {
        return `CACHE_PREFIX_${name}`
    }

    static forRootAsync(
        configKey: string,
        options: {
            useFactory: (...args: any[]) => Promise<CacheModuleOptions> | CacheModuleOptions
            inject: any[]
        }
    ): DynamicModule {
        const redisProvider = {
            provide: CacheModule.getRedisToken(configKey),
            useFactory: async (...args: any[]) => {
                const { connection } = await options.useFactory(...args)
                return connection
            },
            inject: options.inject
        }
        const prefixProvider = {
            provide: CacheModule.getPrefixToken(configKey),
            useFactory: async (...args: any[]) => {
                const { prefix } = await options.useFactory(...args)
                return prefix
            },
            inject: options.inject
        }

        return {
            module: CacheModule,
            providers: [redisProvider, prefixProvider],
            exports: [redisProvider, prefixProvider]
        }
    }

    static register(options: { configKey: string; name: string }): DynamicModule {
        const cacheProvider = {
            provide: CacheService.getToken(options.name),
            useFactory: (redis: Redis, prefix: string) => {
                return new CacheService(redis, prefix + ':' + options.name)
            },
            inject: [
                CacheModule.getRedisToken(options.configKey),
                CacheModule.getPrefixToken(options.configKey)
            ]
        }

        return {
            module: CacheModule,
            providers: [cacheProvider],
            exports: [cacheProvider]
        }
    }
}
