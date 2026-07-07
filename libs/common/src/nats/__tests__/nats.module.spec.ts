import { createTestContext } from '@mannercode/testing'
import { Inject, Injectable, Module } from '@nestjs/common'
import type { NatsConnection } from '../nats.types'
import { NatsConnectionRegistry, NatsModule } from '../nats.module'
import { DEFAULT_NATS_CONNECTION_NAME, getNatsConnectionToken } from '../nats.tokens'

@Injectable()
class SiblingConsumer {
    constructor(@Inject(getNatsConnectionToken('forRoot')) readonly connection: NatsConnection) {}
}

// NatsModule을 import하지 않는 형제 모듈이다.
// 여기서 연결 토큰 주입이 성립하면 forRoot의 전역 노출이 증명된다.
@Module({ providers: [SiblingConsumer] })
class SiblingModule {}

describe('getNatsConnectionToken', () => {
    it('이름이 없으면 기본 이름으로 토큰을 만든다', () => {
        expect(getNatsConnectionToken(undefined)).toBe(
            `NatsConnection:${DEFAULT_NATS_CONNECTION_NAME}`
        )
    })

    it('이름이 있으면 해당 이름으로 토큰을 만든다', () => {
        expect(getNatsConnectionToken('foo')).toBe('NatsConnection:foo')
    })
})

describe('NatsConnectionRegistry', () => {
    it('drain이 실패한 연결이 있어도 onModuleDestroy는 예외를 전파하지 않는다', async () => {
        const registry = new NatsConnectionRegistry()
        const connection = { drain: jest.fn().mockRejectedValue(new Error('boom')) }
        registry.add(connection as any)

        await expect(registry.onModuleDestroy()).resolves.toBeUndefined()
        expect(connection.drain).toHaveBeenCalled()
    })
})

describe('NatsModule', () => {
    it('forRoot는 연결을 전역 제공자로 노출한다', async () => {
        const ctx = await createTestContext({
            imports: [
                NatsModule.forRoot(
                    JSON.parse(process.env.TESTLIB_NATS_OPTIONS as string),
                    'forRoot'
                ),
                SiblingModule
            ]
        })
        try {
            const consumer = ctx.module.get(SiblingConsumer)
            expect(consumer.connection.info).toBeDefined()
        } finally {
            await ctx.close()
        }
    })

    it('forRootAsync는 useFactory의 반환값으로 연결을 만든다', async () => {
        const ctx = await createTestContext({
            imports: [
                NatsModule.forRootAsync(
                    { useFactory: () => JSON.parse(process.env.TESTLIB_NATS_OPTIONS as string) },
                    'forRootAsync'
                )
            ]
        })
        try {
            const nc = ctx.module.get<NatsConnection>(getNatsConnectionToken('forRootAsync'))
            expect(nc.info).toBeDefined()
        } finally {
            await ctx.close()
        }
    })
})
