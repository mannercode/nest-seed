import { createTestContext } from '@mannercode/testing'
import { Inject, Injectable } from '@nestjs/common'
import type { RedisConnection } from '../redis.types'
import { RedisModule } from '../redis.module'
import { getRedisConnectionToken } from '../redis.tokens'

export type RedisModuleFixture = { redis: RedisConnection; teardown: () => Promise<void> }

@Injectable()
class TestRedisConsumer {
    constructor(@Inject(getRedisConnectionToken()) readonly redis: RedisConnection) {}
}

@Injectable()
class TestNamedRedisConsumer {
    constructor(@Inject(getRedisConnectionToken('named')) readonly redis: RedisConnection) {}
}

export async function createRedisModuleFixture() {
    const { close, module } = await createTestContext({
        imports: [RedisModule.forRoot({ type: 'single', url: process.env.TESTLIB_REDIS_URL })],
        providers: [TestRedisConsumer]
    })

    const redis = module.get<RedisConnection>(getRedisConnectionToken())

    // 연결 종료는 RedisConnectionRegistry가 모듈 destroy에서 책임진다.
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

    // 연결 종료는 RedisConnectionRegistry가 모듈 destroy에서 책임진다.
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

    // 연결 종료는 RedisConnectionRegistry가 모듈 destroy에서 책임진다.
    const teardown = async () => {
        await close()
    }

    return { redis, teardown }
}

export async function createRedisModuleUrlOnlyFixture() {
    const { close, module } = await createTestContext({
        imports: [RedisModule.forRoot({ type: 'single', url: process.env.TESTLIB_REDIS_URL })]
    })

    const redis = module.get<RedisConnection>(getRedisConnectionToken())

    // 연결 종료는 RedisConnectionRegistry가 모듈 destroy에서 책임진다.
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

    // 연결 종료는 RedisConnectionRegistry가 모듈 destroy에서 책임진다.
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

    // 연결 종료는 RedisConnectionRegistry가 모듈 destroy에서 책임진다.
    const teardown = async () => {
        await close()
    }

    return { redis, teardown }
}
