describe('temporal.tokens', () => {
    it('이름 없이 호출하면 기본 client 이름을 사용한다', async () => {
        const { getTemporalClientToken, DEFAULT_TEMPORAL_CLIENT_NAME } =
            await import('../temporal.tokens')
        expect(getTemporalClientToken()).toBe(`TemporalClient:${DEFAULT_TEMPORAL_CLIENT_NAME}`)
    })

    it('이름을 주면 그 이름이 client 토큰에 들어간다', async () => {
        const { getTemporalClientToken } = await import('../temporal.tokens')
        expect(getTemporalClientToken('foo')).toBe('TemporalClient:foo')
    })

    it('이름 없이 호출하면 기본 connection 이름을 사용한다', async () => {
        const { getTemporalConnectionToken, DEFAULT_TEMPORAL_CLIENT_NAME } =
            await import('../temporal.tokens')
        expect(getTemporalConnectionToken()).toBe(
            `TemporalConnection:${DEFAULT_TEMPORAL_CLIENT_NAME}`
        )
    })

    it('이름을 주면 그 이름이 connection 토큰에 들어간다', async () => {
        const { getTemporalConnectionToken } = await import('../temporal.tokens')
        expect(getTemporalConnectionToken('bar')).toBe('TemporalConnection:bar')
    })
})
