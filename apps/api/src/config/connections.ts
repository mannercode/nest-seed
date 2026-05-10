import {
    getNatsConnectionToken,
    getRedisConnectionToken,
    getTemporalClientToken
} from '@mannercode/common'
import { getConnectionToken } from '@nestjs/mongoose'

/**
 * 외부 자원과의 연결을 식별하는 이름과 NestJS DI 토큰을 한 자리에서 관리한다.
 * service / repository / health 등이 *-setup 모듈을 직접 참조하지 않고 여기서
 * 가져다 쓴다. *-setup 모듈은 자기 wiring 에서 이 상수를 사용한다.
 */

export const MONGO_CONNECTION_NAME = 'mongo-connection'
export const REDIS_CONNECTION_NAME = 'redis-connection'
export const NATS_CONNECTION_NAME = 'nats-connection'
export const TEMPORAL_CLIENT_NAME = 'temporal-client'

export const MONGO_CONNECTION_TOKEN = getConnectionToken(MONGO_CONNECTION_NAME)
export const REDIS_CONNECTION_TOKEN = getRedisConnectionToken(REDIS_CONNECTION_NAME)
export const NATS_CONNECTION_TOKEN = getNatsConnectionToken(NATS_CONNECTION_NAME)
export const TEMPORAL_CLIENT_TOKEN = getTemporalClientToken(TEMPORAL_CLIENT_NAME)
