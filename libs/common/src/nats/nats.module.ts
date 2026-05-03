import { DynamicModule, Module, Provider } from '@nestjs/common'
import { connect } from 'nats'
import { getNatsConnectionToken } from './nats.tokens'
import { NatsModuleAsyncOptions, NatsModuleOptions } from './nats.types'

@Module({})
export class NatsModule {
    static forRoot(options: NatsModuleOptions, connectionName?: string): DynamicModule {
        const provider = createNatsProvider(options, connectionName)
        return { exports: [provider], global: true, module: NatsModule, providers: [provider] }
    }

    static forRootAsync(options: NatsModuleAsyncOptions, connectionName?: string): DynamicModule {
        const provider: Provider = {
            inject: options.inject ?? [],
            provide: getNatsConnectionToken(connectionName),
            useFactory: async (...args: any[]) => {
                const resolvedOptions = await options.useFactory(...args)
                return connect(resolvedOptions)
            }
        }

        return { exports: [provider], global: true, module: NatsModule, providers: [provider] }
    }
}

function createNatsProvider(options: NatsModuleOptions, connectionName?: string): Provider {
    return {
        provide: getNatsConnectionToken(connectionName),
        useFactory: async () => connect(options)
    }
}
