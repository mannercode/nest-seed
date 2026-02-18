import type Redis from 'ioredis'
import type { Cluster, ClusterNode, ClusterOptions, RedisOptions } from 'ioredis'

export type RedisClusterOptions = {
    type: 'cluster'
    nodes: ClusterNode[]
    options?: ClusterOptions
}

export type RedisSingleOptions = { type: 'single'; url?: string; options?: RedisOptions }

export type RedisModuleOptions = RedisClusterOptions | RedisSingleOptions
export type RedisConnection = Redis | Cluster

export type RedisModuleAsyncOptions = {
    useFactory: (...args: any[]) => Promise<RedisModuleOptions> | RedisModuleOptions
    inject?: any[]
}
