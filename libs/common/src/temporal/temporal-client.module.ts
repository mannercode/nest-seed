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

/**
 * `forRootAsync`가 만든 Temporal 연결을 모두 모아 두고, `onModuleDestroy` 시점에 한꺼번에 닫는다.
 * 한 프로세스 안에 여러 NestJS 앱이 실행 중이어도 (예: 병렬 테스트) 이 레지스트리가 앱마다 제공자로 인스턴스화되므로 연결이 서로 섞이지 않는다.
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

        // connection과 client 두 제공자가 같은 config를 필요로 한다.
        // 각자 `useFactory`를 부르면 호출자의 팩토리(예: 비동기 설정 조회)가 두 번 실행된다.
        // 그래서 config를 한 번만 해석하는 내부 제공자를 두고 둘 다 그 결과를 주입받는다.
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
            // 연결도 내보내, 소비자가 헬스체크 등에 `getTemporalConnectionToken`으로 주입받을 수 있게 한다.
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
