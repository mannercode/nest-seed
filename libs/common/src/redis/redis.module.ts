import { DynamicModule, Injectable, Module, Provider } from '@nestjs/common'
import { Cluster, Redis } from 'ioredis'
import { ConnectionRegistry } from '#common/connection-registry'
import { defaultTo } from '#common/utils'
import { getRedisConnectionToken } from './redis.tokens.js'
import { RedisConnection, RedisModuleAsyncOptions, RedisModuleOptions } from './redis.types.js'

// 모듈이 만든 연결은 모듈이 닫는다. 닫지 않으면 app.close() 뒤에도 소켓이 남아 프로세스가 종료되지 않는다.
@Injectable()
export class RedisConnectionRegistry extends ConnectionRegistry<RedisConnection> {
    protected async close(connection: RedisConnection) {
        await connection.quit()
    }
}

@Module({})
export class RedisModule {
    static forRoot(options: RedisModuleOptions, connectionName?: string): DynamicModule {
        const provider = createRedisProvider(options, connectionName)

        return {
            exports: [provider],
            global: true,
            module: RedisModule,
            providers: [RedisConnectionRegistry, provider]
        }
    }

    static forRootAsync(options: RedisModuleAsyncOptions, connectionName?: string): DynamicModule {
        const provider: Provider = {
            inject: [RedisConnectionRegistry, ...(options.inject ?? [])],
            provide: getRedisConnectionToken(connectionName),
            useFactory: async (registry: RedisConnectionRegistry, ...args: any[]) => {
                const resolvedOptions = await options.useFactory(...args)
                const connection = createRedisClient(resolvedOptions)
                registry.add(connection)
                return connection
            }
        }

        return {
            exports: [provider],
            global: true,
            imports: options.imports,
            module: RedisModule,
            providers: [RedisConnectionRegistry, provider]
        }
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

    return new Redis(defaultTo(options.options, {}))
}

function createRedisProvider(options: RedisModuleOptions, connectionName?: string): Provider {
    return {
        inject: [RedisConnectionRegistry],
        provide: getRedisConnectionToken(connectionName),
        useFactory: async (registry: RedisConnectionRegistry) => {
            const connection = createRedisClient(options)
            registry.add(connection)
            return connection
        }
    }
}
