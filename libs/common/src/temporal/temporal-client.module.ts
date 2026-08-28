import {
    DynamicModule,
    Inject,
    Injectable,
    Module,
    OnModuleDestroy,
    Provider
} from '@nestjs/common'
import { Client, Connection } from '@temporalio/client'
import {
    DEFAULT_TEMPORAL_CLIENT_NAME,
    getTemporalClientToken,
    getTemporalConnectionToken
} from './temporal.tokens'
import { TemporalClientConfig, TemporalClientModuleAsyncOptions } from './temporal.types'

export function InjectTemporalClient(name?: string): ParameterDecorator {
    return Inject(getTemporalClientToken(name))
}

// 앱 단위로 만든 Temporal 연결을 모아 module destroy에서 닫는다.
@Injectable()
export class TemporalConnectionRegistry implements OnModuleDestroy {
    private connections: Connection[] = []

    add(connection: Connection) {
        this.connections.push(connection)
    }

    list(): readonly Connection[] {
        return this.connections
    }

    async onModuleDestroy() {
        const list = this.connections
        this.connections = []
        await Promise.all(list.map((c) => c.close().catch(() => undefined)))
    }
}

@Module({})
export class TemporalClientModule {
    static forRootAsync(
        options: TemporalClientModuleAsyncOptions,
        clientName?: string
    ): DynamicModule {
        const name = clientName ?? DEFAULT_TEMPORAL_CLIENT_NAME

        // connection과 client가 공유하도록 호출자 config factory는 한 번만 실행한다.
        const configToken = `TemporalClientConfig_${name}`

        const configProvider: Provider = {
            inject: options.inject ?? [],
            provide: configToken,
            useFactory: (...args: any[]) => options.useFactory(...args)
        }

        const connectionProvider: Provider = {
            inject: [TemporalConnectionRegistry, configToken],
            provide: getTemporalConnectionToken(name),
            useFactory: async (
                registry: TemporalConnectionRegistry,
                config: TemporalClientConfig
            ) => {
                const connection = await Connection.connect({ address: config.address })
                registry.add(connection)
                return connection
            }
        }

        const clientProvider: Provider = {
            inject: [getTemporalConnectionToken(name), configToken],
            provide: getTemporalClientToken(name),
            useFactory: (connection: Connection, config: TemporalClientConfig) =>
                new Client({ connection, namespace: config.namespace })
        }

        return {
            exports: [connectionProvider, clientProvider],
            global: true,
            module: TemporalClientModule,
            providers: [
                TemporalConnectionRegistry,
                configProvider,
                connectionProvider,
                clientProvider
            ]
        }
    }
}
