import { CloseFixture, HttpTestClient } from 'testlib'

describe('HttpSuccessInterceptor', () => {
    let closeFixture: CloseFixture
    let client: HttpTestClient
    let spy: jest.SpyInstance

    beforeEach(async () => {
        const { createFixture } = await import('./http-success.interceptor.fixture')

        const fixture = await createFixture()
        closeFixture = fixture.closeFixture
        spy = fixture.spy
        client = fixture.client
    })

    afterEach(async () => {
        await closeFixture?.()
    })

    it('Http 요청이 성공하면 Logger.verbose()로 기록해야 한다', async () => {
        await client.get('/').ok()

        expect(spy).toHaveBeenCalledTimes(1)
        expect(spy).toHaveBeenCalledWith(
            'Success',
            'HTTP',
            expect.objectContaining({
                statusCode: 200,
                method: 'GET',
                url: '/',
                runningTime: expect.any(String)
            })
        )
    })
})
