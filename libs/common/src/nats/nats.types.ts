import type { ConnectionOptions, NatsConnection } from 'nats'

export type NatsModuleOptions = ConnectionOptions

export type NatsModuleAsyncOptions = {
    inject?: any[]
    useFactory: (...args: any[]) => Promise<NatsModuleOptions> | NatsModuleOptions
}

export type { NatsConnection }
