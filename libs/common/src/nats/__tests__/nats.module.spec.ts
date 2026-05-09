import { createTestContext } from '@mannercode/testing'
import type { NatsConnection } from '../nats.types'
import { NatsModule } from '../nats.module'
import { DEFAULT_NATS_CONNECTION_NAME, getNatsConnectionToken } from '../nats.tokens'

describe('getNatsConnectionToken', () => {
    it('이름이 없으면 기본 connection 이름을 사용한다', () => {
        expect(getNatsConnectionToken()).toBe(`NatsConnection:${DEFAULT_NATS_CONNECTION_NAME}`)
    })

    it('이름을 주면 토큰에 반영된다', () => {
        expect(getNatsConnectionToken('foo')).toBe('NatsConnection:foo')
    })
})

describe('NatsModule', () => {
    it('forRoot 가 connection 을 글로벌 provider 로 노출한다', async () => {
        const ctx = await createTestContext({
            imports: [
                NatsModule.forRoot(
                    JSON.parse(process.env.TESTLIB_NATS_OPTIONS as string),
                    'forRoot'
                )
            ]
        })
        try {
            const nc = ctx.module.get<NatsConnection>(getNatsConnectionToken('forRoot'))
            expect(nc.info).toBeDefined()
            await nc.drain()
        } finally {
            await ctx.close()
        }
    })

    it('forRootAsync 가 useFactory 결과로 connection 을 만든다', async () => {
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
            await nc.drain()
        } finally {
            await ctx.close()
        }
    })
})
