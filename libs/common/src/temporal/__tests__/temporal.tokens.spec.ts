describe('temporal.tokens', () => {
    describe('getTemporalClientToken', () => {
        it.each([
            [undefined, undefined as string | undefined],
            ['foo', 'foo']
        ])('name=%s 일 때 client 토큰을 만든다', async (name, explicit) => {
            const { getTemporalClientToken, DEFAULT_TEMPORAL_CLIENT_NAME } =
                await import('../temporal.tokens')
            const expected = `TemporalClient:${explicit ?? DEFAULT_TEMPORAL_CLIENT_NAME}`
            expect(getTemporalClientToken(name)).toBe(expected)
        })
    })

    describe('getTemporalConnectionToken', () => {
        it.each([
            [undefined, undefined as string | undefined],
            ['bar', 'bar']
        ])('name=%s 일 때 connection 토큰을 만든다', async (name, explicit) => {
            const { getTemporalConnectionToken, DEFAULT_TEMPORAL_CLIENT_NAME } =
                await import('../temporal.tokens')
            const expected = `TemporalConnection:${explicit ?? DEFAULT_TEMPORAL_CLIENT_NAME}`
            expect(getTemporalConnectionToken(name)).toBe(expected)
        })
    })
})
