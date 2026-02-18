import { DynamicModule, Provider } from '@nestjs/common'
import { Module } from '@nestjs/common'
import Redis, { Cluster } from 'ioredis'
import { getRedisConnectionToken } from './redis.tokens'
import { RedisConnection, RedisModuleAsyncOptions, RedisModuleOptions } from './redis.types'

@Module({})
export class RedisModule {
    static forRoot(options: RedisModuleOptions, connectionName?: string): DynamicModule {
        const provider = createRedisProvider(options, connectionName)

        return { exports: [provider], global: true, module: RedisModule, providers: [provider] }
    }

    static forRootAsync(options: RedisModuleAsyncOptions, connectionName?: string): DynamicModule {
        const provider: Provider = {
            inject: options.inject ?? [],
            provide: getRedisConnectionToken(connectionName),
            useFactory: async (...args: any[]) => {
                const resolvedOptions = await options.useFactory(...args)
                return createRedisClient(resolvedOptions)
            }
        }

        return { exports: [provider], global: true, module: RedisModule, providers: [provider] }
    }
}

function createRedisClient(options: RedisModuleOptions): RedisConnection {
    if (options.type === 'cluster') {
        return new Cluster(options.nodes, options.options)
    }

    if (options.url && options.options) {
        return new Redis(options.url, options.options)
    }

    if (options.url) {
        return new Redis(options.url)
    }

    if (options.options) {
        return new Redis(options.options)
    }

    return new Redis()
}

function createRedisProvider(options: RedisModuleOptions, connectionName?: string): Provider {
    return {
        provide: getRedisConnectionToken(connectionName),
        useFactory: async () => createRedisClient(options)
    }
}
