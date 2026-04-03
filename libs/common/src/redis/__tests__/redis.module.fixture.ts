import { createTestContext, getRedisTestConnection } from '@mannercode/testing'
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
        imports: [RedisModule.forRoot({ type: 'single', url: getRedisTestConnection() })],
        providers: [TestRedisConsumer]
    })

    const redis = module.get<RedisConnection>(getRedisConnectionToken())

    const teardown = async () => {
        await close()
        await redis.quit()
    }

    return { redis, teardown }
}

export async function createRedisModuleNamedFixture() {
    const { close, module } = await createTestContext({
        imports: [RedisModule.forRoot({ type: 'single', url: getRedisTestConnection() }, 'named')],
        providers: [TestNamedRedisConsumer]
    })

    const redis = module.get<RedisConnection>(getRedisConnectionToken('named'))

    const teardown = async () => {
        await close()
        await redis.quit()
    }

    return { redis, teardown }
}

export async function createRedisModuleAsyncFixture() {
    const { close, module } = await createTestContext({
        imports: [
            RedisModule.forRootAsync({
                useFactory: () => ({ type: 'single' as const, url: getRedisTestConnection() })
            })
        ],
        providers: [TestRedisConsumer]
    })

    const redis = module.get<RedisConnection>(getRedisConnectionToken())

    const teardown = async () => {
        await close()
        await redis.quit()
    }

    return { redis, teardown }
}

export async function createRedisModuleUrlOnlyFixture() {
    const { close, module } = await createTestContext({
        imports: [RedisModule.forRoot({ type: 'single', url: getRedisTestConnection() })]
    })

    const redis = module.get<RedisConnection>(getRedisConnectionToken())

    const teardown = async () => {
        await close()
        await redis.quit()
    }

    return { redis, teardown }
}

export async function createRedisModuleOptionsOnlyFixture() {
    const url = new URL(getRedisTestConnection())

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
        await redis.quit()
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
                url: getRedisTestConnection(),
                options: { db: 0 }
            })
        ]
    })

    const redis = module.get<RedisConnection>(getRedisConnectionToken())

    const teardown = async () => {
        await close()
        await redis.quit()
    }

    return { redis, teardown }
}
