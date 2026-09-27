import type { connect, NodeConnectionOptions } from '@nats-io/transport-node'

// 직접 설치하지 않은 nats-core에서 타입을 가져오는 대신, 공개 connect 함수의 반환 타입을 사용한다.
export type NatsConnection = Awaited<ReturnType<typeof connect>>

export type NatsModuleOptions = NodeConnectionOptions

export type NatsModuleAsyncOptions = {
    inject?: any[]
    useFactory: (...args: any[]) => Promise<NatsModuleOptions> | NatsModuleOptions
}
