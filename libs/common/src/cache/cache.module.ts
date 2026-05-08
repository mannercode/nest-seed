import { DynamicModule, Inject, Module } from '@nestjs/common'
import Redis from 'ioredis'
import { getRedisConnectionToken } from '../redis'
import { defaultTo } from '../utils'
import { CacheService } from './cache.service'
import { CacheModuleOptions } from './cache.types'

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
