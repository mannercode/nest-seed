describe('getTemporalClientToken', () => {
    it('이름이 없으면 기본 이름으로 client 토큰을 만든다', async () => {
        const { getTemporalClientToken, DEFAULT_TEMPORAL_CLIENT_NAME } =
            await import('../temporal.tokens')
        expect(getTemporalClientToken(undefined)).toBe(
            `TemporalClient:${DEFAULT_TEMPORAL_CLIENT_NAME}`
        )
    })

    it('이름이 있으면 해당 이름으로 client 토큰을 만든다', async () => {
        const { getTemporalClientToken } = await import('../temporal.tokens')
        expect(getTemporalClientToken('foo')).toBe('TemporalClient:foo')
    })
})

describe('getTemporalConnectionToken', () => {
    it('이름이 없으면 기본 이름으로 connection 토큰을 만든다', async () => {
        const { getTemporalConnectionToken, DEFAULT_TEMPORAL_CLIENT_NAME } =
            await import('../temporal.tokens')
        expect(getTemporalConnectionToken(undefined)).toBe(
            `TemporalConnection:${DEFAULT_TEMPORAL_CLIENT_NAME}`
        )
    })

    it('이름이 있으면 해당 이름으로 connection 토큰을 만든다', async () => {
        const { getTemporalConnectionToken } = await import('../temporal.tokens')
        expect(getTemporalConnectionToken('bar')).toBe('TemporalConnection:bar')
    })
})
