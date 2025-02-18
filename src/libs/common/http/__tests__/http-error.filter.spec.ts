import { HttpTestClient, TestContext } from 'testlib'

describe('ErrorFilter', () => {
    let testContext: TestContext
    let client: HttpTestClient
    let spy: jest.SpyInstance

    beforeEach(async () => {
        const { createFixture } = await import('./http-error.filter.fixture')
        const fixture = await createFixture()

        testContext = fixture.testContext
        spy = fixture.spy
        client = fixture.client
    })

    afterEach(async () => {
        await testContext?.close()
    })

    it('should call Logger.error() when an error occurs', async () => {
        await client.get('/').internalServerError()

        expect(spy).toHaveBeenCalledTimes(1)
        expect(spy).toHaveBeenCalledWith(
            'test',
            'HTTP',
            expect.objectContaining({
                statusCode: 500,
                method: 'GET',
                url: '/',
                body: undefined,
                stack: expect.any(String)
            })
        )
    })
})
