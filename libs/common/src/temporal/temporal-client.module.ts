import { DynamicModule, Inject, Module, OnModuleDestroy, Provider } from '@nestjs/common'
import { Client, Connection } from '@temporalio/client'
import {
    DEFAULT_TEMPORAL_CLIENT_NAME,
    getTemporalClientToken,
    getTemporalConnectionToken
} from './temporal.tokens'
import { TemporalClientModuleAsyncOptions } from './temporal.types'

export function InjectTemporalClient(name?: string): ParameterDecorator {
    return Inject(getTemporalClientToken(name))
}

@Module({})
export class TemporalClientModule implements OnModuleDestroy {
    private static connections: Connection[] = []

    static forRootAsync(
        options: TemporalClientModuleAsyncOptions,
        clientName?: string
    ): DynamicModule {
        const name = clientName ?? DEFAULT_TEMPORAL_CLIENT_NAME

        const connectionProvider: Provider = {
            inject: options.inject ?? [],
            provide: getTemporalConnectionToken(name),
            useFactory: async (...args: any[]) => {
                const config = await options.useFactory(...args)
                const connection = await Connection.connect({ address: config.address })
                TemporalClientModule.connections.push(connection)
                return connection
            }
        }

        const clientProvider: Provider = {
            inject: [getTemporalConnectionToken(name), ...(options.inject ?? [])],
            provide: getTemporalClientToken(name),
            useFactory: async (connection: Connection, ...args: any[]) => {
                const config = await options.useFactory(...args)
                return new Client({ connection, namespace: config.namespace })
            }
        }

        return {
            exports: [clientProvider],
            global: true,
            module: TemporalClientModule,
            providers: [connectionProvider, clientProvider]
        }
    }

    async onModuleDestroy() {
        await Promise.all(
            TemporalClientModule.connections.map((c) => c.close().catch(() => undefined))
        )
        TemporalClientModule.connections = []
    }
}
