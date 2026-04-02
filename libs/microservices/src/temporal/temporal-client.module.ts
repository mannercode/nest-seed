import { DynamicModule } from '@nestjs/common'
import { Global, Inject, Module } from '@nestjs/common'
import { Client, Connection } from '@temporalio/client'

export type TemporalClientModuleOptions = {
    inject?: any[]
    useFactory: (...args: any[]) => TemporalClientConfig | Promise<TemporalClientConfig>
}

export type TemporalClientConfig = { address: string; namespace: string }

const TEMPORAL_CONNECTION = Symbol('TEMPORAL_CONNECTION')
export const TEMPORAL_CLIENT = Symbol('TEMPORAL_CLIENT')

export function InjectTemporalClient(): ParameterDecorator {
    return Inject(TEMPORAL_CLIENT)
}

@Global()
@Module({})
export class TemporalClientModule {
    static registerAsync(options: TemporalClientModuleOptions): DynamicModule {
        const { inject, useFactory } = options

        const connectionProvider = {
            provide: TEMPORAL_CONNECTION,
            inject,
            useFactory: async (...args: any[]) => {
                const config = await useFactory(...args)
                return Connection.connect({ address: config.address })
            }
        }

        const clientProvider = {
            provide: TEMPORAL_CLIENT,
            inject: [TEMPORAL_CONNECTION, ...(inject ?? [])],
            useFactory: async (connection: Connection, ...args: any[]) => {
                const config = await useFactory(...args)
                return new Client({ connection, namespace: config.namespace })
            }
        }

        return {
            module: TemporalClientModule,
            providers: [connectionProvider, clientProvider],
            exports: [TEMPORAL_CLIENT]
        }
    }
}
