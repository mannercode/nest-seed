export const DEFAULT_REDIS_CONNECTION_NAME = 'default'

export function getRedisConnectionToken(name?: string) {
    const connectionName = name ?? DEFAULT_REDIS_CONNECTION_NAME
    return `RedisConnection:${connectionName}`
}
