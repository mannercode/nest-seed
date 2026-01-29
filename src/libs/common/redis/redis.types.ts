import type { ClusterNode, ClusterOptions, RedisOptions } from 'ioredis'

export type RedisClusterOptions = {
    type: 'cluster'
    nodes: ClusterNode[]
    options?: ClusterOptions
}

export type RedisSingleOptions = { type: 'single'; url?: string; options?: RedisOptions }

export type RedisModuleOptions = RedisClusterOptions | RedisSingleOptions

export type RedisModuleAsyncOptions = {
    useFactory: (...args: any[]) => Promise<RedisModuleOptions> | RedisModuleOptions
    inject?: any[]
}
