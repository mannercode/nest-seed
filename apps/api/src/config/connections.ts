/**
 * 외부 자원과의 연결을 식별하는 이름. *-setup 모듈은 자기 wiring 에서 이 이름을
 * 사용하고, DI 토큰이 필요한 호출자는 각 라이브러리의 토큰 헬퍼 (getConnectionToken,
 * getRedisConnectionToken 등) 를 직접 부른다.
 */

export const MONGO_CONNECTION_NAME = 'mongo-connection'
export const REDIS_CONNECTION_NAME = 'redis-connection'
export const NATS_CONNECTION_NAME = 'nats-connection'
export const TEMPORAL_CLIENT_NAME = 'temporal-client'
