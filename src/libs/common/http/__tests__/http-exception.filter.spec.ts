import { HttpTestClient, TestContext } from 'testlib'

describe('HttpExceptionFilter', () => {
    let testContext: TestContext
    let client: HttpTestClient
    let spy: jest.SpyInstance

    beforeEach(async () => {
        const { createFixture } = await import('./http-exception.filter.fixture')

        const fixture = await createFixture()
        testContext = fixture.testContext
        spy = fixture.spy
        client = fixture.client
    })

    afterEach(async () => {
        await testContext?.close()
    })

    it('should call Logger.warn() when an HttpException occurs', async () => {
        await client.get('/').badRequest()

        expect(spy).toHaveBeenCalledTimes(1)
        expect(spy).toHaveBeenCalledWith(
            'http-exception',
            'HTTP',
            expect.objectContaining({
                request: { body: undefined, method: 'GET', url: '/' },
                response: { error: 'Bad Request', message: 'http-exception', statusCode: 400 },
                stack: expect.any(String)
            })
        )
    })
})
