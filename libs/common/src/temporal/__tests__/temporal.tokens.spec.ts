describe('temporal.tokens', () => {
    // 이름 없이 호출하면 기본 이름을 사용한다
    it('returns the default client token when no name is given', async () => {
        const { getTemporalClientToken, DEFAULT_TEMPORAL_CLIENT_NAME } =
            await import('../temporal.tokens')
        expect(getTemporalClientToken()).toBe(`TemporalClient:${DEFAULT_TEMPORAL_CLIENT_NAME}`)
    })

    // 이름을 주면 그 이름이 client 토큰에 들어간다
    it('embeds the explicit name into the client token', async () => {
        const { getTemporalClientToken } = await import('../temporal.tokens')
        expect(getTemporalClientToken('foo')).toBe('TemporalClient:foo')
    })

    // 이름 없이 호출하면 기본 이름을 사용한다 (connection)
    it('returns the default connection token when no name is given', async () => {
        const { getTemporalConnectionToken, DEFAULT_TEMPORAL_CLIENT_NAME } =
            await import('../temporal.tokens')
        expect(getTemporalConnectionToken()).toBe(
            `TemporalConnection:${DEFAULT_TEMPORAL_CLIENT_NAME}`
        )
    })

    // 이름을 주면 그 이름이 connection 토큰에 들어간다
    it('embeds the explicit name into the connection token', async () => {
        const { getTemporalConnectionToken } = await import('../temporal.tokens')
        expect(getTemporalConnectionToken('bar')).toBe('TemporalConnection:bar')
    })
})
