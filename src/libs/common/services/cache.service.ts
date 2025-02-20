import { getRedisConnectionToken } from '@nestjs-modules/ioredis'
import { DynamicModule, Inject, Injectable, Module } from '@nestjs/common'
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

@Module({})
export class CacheModule {
    static register(options: { name: string; redisName: string; prefix: string }): DynamicModule {
        const { name, redisName, prefix } = options

        const provider = {
            provide: CacheService.getToken(name),
            useFactory: async (redis: Redis) => {
                return new CacheService(redis, prefix + ':' + name)
            },
            inject: [getRedisConnectionToken(redisName)]
        }

        return {
            module: CacheModule,
            providers: [provider],
            exports: [provider]
        }
    }
}
