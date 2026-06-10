import { DynamicModule, Injectable, Module, OnModuleDestroy, Provider } from '@nestjs/common'
import Redis, { Cluster } from 'ioredis'
import { defaultTo } from '../utils'
import { getRedisConnectionToken } from './redis.tokens'
import { RedisConnection, RedisModuleAsyncOptions, RedisModuleOptions } from './redis.types'

// 모듈이 만든 연결은 모듈이 닫는다. 닫지 않으면 app.close() 뒤에도 소켓이 남아 프로세스가 매달린다.
@Injectable()
export class RedisConnectionRegistry implements OnModuleDestroy {
    private connections: RedisConnection[] = []

    add(connection: RedisConnection) {
        this.connections.push(connection)
    }

    async onModuleDestroy() {
        const list = this.connections
        this.connections = []
        await Promise.all(list.map((c) => c.quit().catch(() => undefined)))
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
