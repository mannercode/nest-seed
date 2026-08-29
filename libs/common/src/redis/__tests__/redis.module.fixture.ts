import { createTestContext } from '@mannercode/testing'
import { Inject, Injectable } from '@nestjs/common'
import type { RedisConnection } from '../redis.types.js'
import { RedisModule } from '../redis.module.js'
import { getRedisConnectionToken } from '../redis.tokens.js'

export type RedisModuleFixture = { redis: RedisConnection; teardown: () => Promise<void> }

@Injectable()
class TestRedisConsumer {
    constructor(@Inject(getRedisConnectionToken()) readonly redis: RedisConnection) {}
}

@Injectable()
class TestNamedRedisConsumer {
    constructor(@Inject(getRedisConnectionToken('named')) readonly redis: RedisConnection) {}
}

// 아래 fixture의 teardown은 모듈만 닫고, 등록된 연결 종료는 RedisConnectionRegistry에 맡긴다.
export async function createRedisModuleFixture() {
    const { close, module } = await createTestContext({
        imports: [RedisModule.forRoot({ type: 'single', url: process.env.TESTLIB_REDIS_URL })],
        providers: [TestRedisConsumer]
    })

    const redis = module.get<RedisConnection>(getRedisConnectionToken())

    const teardown = async () => {
        await close()
    }

    return { redis, teardown }
}

export async function createRedisModuleNamedFixture() {
    const { close, module } = await createTestContext({
        imports: [
            RedisModule.forRoot({ type: 'single', url: process.env.TESTLIB_REDIS_URL }, 'named')
        ],
        providers: [TestNamedRedisConsumer]
    })

    const redis = module.get<RedisConnection>(getRedisConnectionToken('named'))

    const teardown = async () => {
        await close()
    }

    return { redis, teardown }
}

export async function createRedisModuleAsyncFixture() {
    const { close, module } = await createTestContext({
        imports: [
            RedisModule.forRootAsync({
                useFactory: () => ({ type: 'single' as const, url: process.env.TESTLIB_REDIS_URL })
            })
        ],
        providers: [TestRedisConsumer]
    })

    const redis = module.get<RedisConnection>(getRedisConnectionToken())

    const teardown = async () => {
        await close()
    }

    return { redis, teardown }
}

export async function createRedisModuleOptionsOnlyFixture() {
    const url = new URL(process.env.TESTLIB_REDIS_URL as string)

    const { close, module } = await createTestContext({
        imports: [
            RedisModule.forRoot({
                type: 'single',
                options: { host: url.hostname, port: parseInt(url.port) }
            })
        ]
    })

    const redis = module.get<RedisConnection>(getRedisConnectionToken())

    const teardown = async () => {
        await close()
    }

    return { redis, teardown }
}

export async function createRedisModuleClusterFixture() {
    const { close, module } = await createTestContext({
        imports: [
            RedisModule.forRoot({ type: 'cluster', nodes: [{ host: 'localhost', port: 7000 }] })
        ]
    })

    const redis = module.get<RedisConnection>(getRedisConnectionToken())

    const teardown = async () => {
        await close()
    }

    return { redis, teardown }
}

export async function createRedisModuleUrlWithOptionsFixture() {
    const { close, module } = await createTestContext({
        imports: [
            RedisModule.forRoot({
                type: 'single',
                url: process.env.TESTLIB_REDIS_URL,
                options: { db: 0 }
            })
        ]
    })

    const redis = module.get<RedisConnection>(getRedisConnectionToken())

    const teardown = async () => {
        await close()
    }

    return { redis, teardown }
}

export async function createRedisModuleDbSelectionFixture() {
    // TESTLIB_REDIS_URL에는 db 경로가 없으므로 db0 연결은 기본 db(0)에 붙는다.
    const { close, module } = await createTestContext({
        imports: [
            RedisModule.forRoot({ type: 'single', url: process.env.TESTLIB_REDIS_URL }, 'db0'),
            RedisModule.forRoot(
                { type: 'single', url: process.env.TESTLIB_REDIS_URL, options: { db: 1 } },
                'db1'
            )
        ]
    })

    const redisDb0 = module.get<RedisConnection>(getRedisConnectionToken('db0'))
    const redisDb1 = module.get<RedisConnection>(getRedisConnectionToken('db1'))

    const teardown = async () => {
        await close()
    }

    return { redisDb0, redisDb1, teardown }
}
