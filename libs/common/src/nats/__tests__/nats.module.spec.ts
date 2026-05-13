import { createTestContext } from '@mannercode/testing'
import type { NatsConnection } from '../nats.types'
import { NatsModule } from '../nats.module'
import { DEFAULT_NATS_CONNECTION_NAME, getNatsConnectionToken } from '../nats.tokens'

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

describe('NatsModule', () => {
    it('forRoot는 연결을 전역 제공자로 노출한다', async () => {
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
            await nc.drain()
        } finally {
            await ctx.close()
        }
    })
})
