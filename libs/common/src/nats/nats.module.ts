import { DynamicModule, Injectable, Module, OnModuleDestroy, Provider } from '@nestjs/common'
import { connect, type NatsConnection } from 'nats'
import { getNatsConnectionToken } from './nats.tokens'
import { NatsModuleAsyncOptions, NatsModuleOptions } from './nats.types'

// 모듈이 만든 연결은 모듈이 닫는다. drain은 전달 중인 메시지를 비운 뒤 닫는다.
@Injectable()
export class NatsConnectionRegistry implements OnModuleDestroy {
    private connections: NatsConnection[] = []

    add(connection: NatsConnection) {
        this.connections.push(connection)
    }

    async onModuleDestroy() {
        const list = this.connections
        this.connections = []
        await Promise.all(list.map((c) => c.drain().catch(() => undefined)))
    }
}

@Module({})
export class NatsModule {
    static forRoot(options: NatsModuleOptions, connectionName?: string): DynamicModule {
        const provider = createNatsProvider(options, connectionName)
        return {
            exports: [provider],
            global: true,
            module: NatsModule,
            providers: [NatsConnectionRegistry, provider]
        }
    }

    static forRootAsync(options: NatsModuleAsyncOptions, connectionName?: string): DynamicModule {
        const provider: Provider = {
            inject: [NatsConnectionRegistry, ...(options.inject ?? [])],
            provide: getNatsConnectionToken(connectionName),
            useFactory: async (registry: NatsConnectionRegistry, ...args: any[]) => {
                const resolvedOptions = await options.useFactory(...args)
                const connection = await connect(resolvedOptions)
                registry.add(connection)
                return connection
            }
        }

        return {
            exports: [provider],
            global: true,
            module: NatsModule,
            providers: [NatsConnectionRegistry, provider]
        }
    }
}

function createNatsProvider(options: NatsModuleOptions, connectionName?: string): Provider {
    return {
        inject: [NatsConnectionRegistry],
        provide: getNatsConnectionToken(connectionName),
        useFactory: async (registry: NatsConnectionRegistry) => {
            const connection = await connect(options)
            registry.add(connection)
            return connection
        }
    }
}
