import { createTestContext } from '@mannercode/testing'
import type { NatsConnection } from '../nats.types'
import { getNatsTestConnection } from '../../infra-connections'
import { NatsModule } from '../nats.module'
import { DEFAULT_NATS_CONNECTION_NAME, getNatsConnectionToken } from '../nats.tokens'

describe('getNatsConnectionToken', () => {
    // 이름이 없으면 기본 connection 이름을 사용한다
    it('uses the default connection name when none is provided', () => {
        expect(getNatsConnectionToken()).toBe(`NatsConnection:${DEFAULT_NATS_CONNECTION_NAME}`)
    })

    // 이름을 주면 토큰에 반영된다
    it('embeds the explicit name into the token', () => {
        expect(getNatsConnectionToken('foo')).toBe('NatsConnection:foo')
    })
})

describe('NatsModule', () => {
    // forRoot 가 connection 을 글로벌 provider 로 노출한다
    it('exposes the connection via forRoot', async () => {
        const ctx = await createTestContext({
            imports: [NatsModule.forRoot(getNatsTestConnection(), 'forRoot')]
        })
        try {
            const nc = ctx.module.get<NatsConnection>(getNatsConnectionToken('forRoot'))
            expect(nc.info).toBeDefined()
            await nc.drain()
        } finally {
            await ctx.close()
        }
    })

    // forRootAsync 가 useFactory 결과로 connection 을 만든다
    it('builds the connection from useFactory in forRootAsync', async () => {
        const ctx = await createTestContext({
            imports: [
                NatsModule.forRootAsync(
                    { useFactory: () => getNatsTestConnection() },
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
