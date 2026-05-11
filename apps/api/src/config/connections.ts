/**
 * 외부 자원 연결에 붙인 이름. 각 `*-setup` 모듈이 자기 wiring 에서 이 이름을
 * 그대로 쓰고, DI 토큰이 필요한 곳은 라이브러리의 토큰 헬퍼(예:
 * `getConnectionToken`)에 같은 이름을 넘긴다.
 */

export const MONGO_CONNECTION_NAME = 'mongo-connection'
export const REDIS_CONNECTION_NAME = 'redis-connection'
export const NATS_CONNECTION_NAME = 'nats-connection'
export const TEMPORAL_CLIENT_NAME = 'temporal-client'
