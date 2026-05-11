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
import { TemporalClientModuleAsyncOptions } from './temporal.types'

export function InjectTemporalClient(name?: string): ParameterDecorator {
    return Inject(getTemporalClientToken(name))
}

/**
 * `forRootAsync`가 만든 Temporal 연결을 모두 모아 두고, `onModuleDestroy`
 * 시점에 한꺼번에 닫습니다. 한 프로세스 안에 여러 NestJS 앱이 실행 중이어도 (예:
 * 병렬 테스트) 이 registry가 앱마다 provider로 인스턴스화되므로 연결이
 * 서로 섞이지 않습니다.
 */
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

        const connectionProvider: Provider = {
            inject: [TemporalConnectionRegistry, ...(options.inject ?? [])],
            provide: getTemporalConnectionToken(name),
            useFactory: async (registry: TemporalConnectionRegistry, ...args: any[]) => {
                const config = await options.useFactory(...args)
                const connection = await Connection.connect({ address: config.address })
                registry.add(connection)
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
            providers: [TemporalConnectionRegistry, connectionProvider, clientProvider]
        }
    }
}
