import { DynamicModule, Module, Provider } from '@nestjs/common'
import Redis, { Cluster } from 'ioredis'
import { getRedisConnectionToken } from './redis.tokens'
import { RedisModuleAsyncOptions, RedisModuleOptions } from './redis.types'

@Module({})
export class RedisModule {
    static forRoot(options: RedisModuleOptions, connectionName?: string): DynamicModule {
        const provider = createRedisProvider(options, connectionName)

        return { module: RedisModule, global: true, providers: [provider], exports: [provider] }
    }

    static forRootAsync(options: RedisModuleAsyncOptions, connectionName?: string): DynamicModule {
        const provider: Provider = {
            provide: getRedisConnectionToken(connectionName),
            useFactory: async (...args: any[]) => {
                const resolvedOptions = await options.useFactory(...args)
                return createRedisClient(resolvedOptions)
            },
            inject: options.inject ?? []
        }

        return { module: RedisModule, global: true, providers: [provider], exports: [provider] }
    }
}

function createRedisProvider(options: RedisModuleOptions, connectionName?: string): Provider {
    return {
        provide: getRedisConnectionToken(connectionName),
        useFactory: async () => createRedisClient(options)
    }
}

function createRedisClient(options: RedisModuleOptions): Redis {
    if (options.type === 'cluster') {
        return new Cluster(options.nodes, options.options) as unknown as Redis
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
