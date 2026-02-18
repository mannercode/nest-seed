import { DynamicModule } from '@nestjs/common'
import { Inject, Injectable, Module } from '@nestjs/common'
import Redis from 'ioredis'
import { defaultTo } from 'lodash'
import { getRedisConnectionToken } from '../redis'

@Injectable()
export class CacheService {
    constructor(
        private readonly redis: Redis,
        private readonly prefix: string
    ) {}

    static getName(name?: string) {
        return `CacheService_${defaultTo(name, 'default')}`
    }

    async delete(key: string) {
        await this.redis.del(this.getKey(key))
    }

    /**
     * Runs a Lua script with namespaced keys.
     * The cache prefix is always inserted as the first ARGV value.
     */
    async executeScript<T = unknown>(
        script: string,
        keys: string[],
        scriptArgs: string[]
    ): Promise<T> {
        const result = await this.redis.eval(
            script,
            keys.length,
            ...keys.map(this.getKey.bind(this)),
            this.prefix,
            ...scriptArgs
        )
        return result as T
    }

    async get(key: string): Promise<null | string> {
        const value = await this.redis.get(this.getKey(key))
        return value
    }

    async set(key: string, value: string, ttlMs = 0) {
        if (ttlMs < 0) {
            throw new Error('TTL must be a non-negative integer (0 for no expiration)')
        }

        if (0 < ttlMs) {
            await this.redis.set(this.getKey(key), value, 'PX', ttlMs)
        } else {
            await this.redis.set(this.getKey(key), value)
        }
    }

    private getKey(key: string) {
        return `${this.prefix}:${key}`
    }
}

export type CacheModuleOptions = { name?: string; prefix: string; redisName?: string }

export function InjectCache(name?: string): ParameterDecorator {
    return Inject(CacheService.getName(name))
}

@Module({})
export class CacheModule {
    static register(options: CacheModuleOptions): DynamicModule {
        const { name, prefix, redisName } = options

        const provider = {
            inject: [getRedisConnectionToken(redisName)],
            provide: CacheService.getName(name),
            useFactory: async (redis: Redis) =>
                new CacheService(redis, `${prefix}:${defaultTo(name, 'default')}`)
        }

        return { exports: [provider], module: CacheModule, providers: [provider] }
    }
}
