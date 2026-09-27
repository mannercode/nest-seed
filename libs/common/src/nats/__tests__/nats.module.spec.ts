import { createTestContext } from '@mannercode/testing'
import { Inject, Injectable, Module } from '@nestjs/common'
import {
    DEFAULT_NATS_CONNECTION_NAME,
    getNatsConnectionToken,
    NatsConnectionRegistry,
    NatsModule,
    type NatsConnection
} from '../index.js'

@Injectable()
class SiblingConsumer {
    constructor(@Inject(getNatsConnectionToken('forRoot')) readonly connection: NatsConnection) {}
}

// NatsModule을 import하지 않는 형제 모듈이다.
// 여기서 연결 토큰 주입이 성립하면 forRoot의 전역 노출이 증명된다.
@Module({ providers: [SiblingConsumer] })
class SiblingModule {}

describe('getNatsConnectionToken', () => {
    describe('연결 이름이 없으면', () => {
        let name: Parameters<typeof getNatsConnectionToken>[0]
        beforeEach(() => {
            name = undefined
        })
        it('주입 토큰을 만들면 기본 이름을 사용한다', () => {
            expect(getNatsConnectionToken(name)).toBe(
                `NatsConnection:${DEFAULT_NATS_CONNECTION_NAME}`
            )
        })
    })

    describe('연결 이름이 지정되어 있으면', () => {
        let name: Parameters<typeof getNatsConnectionToken>[0]
        beforeEach(() => {
            name = 'foo'
        })
        it('주입 토큰을 만들면 지정한 이름을 사용한다', () => {
            expect(getNatsConnectionToken(name)).toBe('NatsConnection:foo')
        })
    })
})

describe('NatsConnectionRegistry', () => {
    describe('drain이 실패하는 연결이 등록되어 있으면', () => {
        let registry: NatsConnectionRegistry
        let connection: { drain: ReturnType<typeof vi.fn> }
        beforeEach(() => {
            registry = new NatsConnectionRegistry()
            connection = { drain: vi.fn().mockRejectedValue(new Error('boom')) }
            registry.add(connection as any)
        })
        it('종료 시 연결의 drain을 호출하고 오류는 전파하지 않는다', async () => {
            await expect(registry.onModuleDestroy()).resolves.toBeUndefined()
            expect(connection.drain).toHaveBeenCalled()
        })
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
