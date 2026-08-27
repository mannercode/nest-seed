import type { connect, NodeConnectionOptions } from '@nats-io/transport-node'

// Node transport의 공개 factory에서 타입을 유도해 transitive nats-core에 직접 결합하지 않는다.
export type NatsConnection = Awaited<ReturnType<typeof connect>>

export type NatsModuleOptions = NodeConnectionOptions

export type NatsModuleAsyncOptions = {
    inject?: any[]
    useFactory: (...args: any[]) => Promise<NatsModuleOptions> | NatsModuleOptions
}
