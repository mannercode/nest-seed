import type Redis from 'ioredis'
import type { Cluster, ClusterNode, ClusterOptions, RedisOptions } from 'ioredis'

export type RedisClusterOptions = {
    nodes: ClusterNode[]
    options?: ClusterOptions
    type: 'cluster'
}

export type RedisConnection = Cluster | Redis

export type RedisModuleAsyncOptions = {
    inject?: any[]
    useFactory: (...args: any[]) => Promise<RedisModuleOptions> | RedisModuleOptions
}
export type RedisModuleOptions = RedisClusterOptions | RedisSingleOptions

export type RedisSingleOptions = { options?: RedisOptions; type: 'single'; url?: string }
