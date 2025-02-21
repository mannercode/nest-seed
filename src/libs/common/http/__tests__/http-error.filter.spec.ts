import { HttpTestClient, TestContext } from 'testlib'

describe('HttpErrorFilter', () => {
    let testContext: TestContext
    let client: HttpTestClient

    beforeEach(async () => {
        const { createFixture } = await import('./http-error.filter.fixture')
        const fixture = await createFixture()

        testContext = fixture.testContext
        client = fixture.client
    })

    afterEach(async () => {
        await testContext?.close()
    })

    it('Error를 던지면 INTERNAL_SERVER_ERROR(500)를 반환해야 한다', async () => {
        await client.get('/').internalServerError({
            message: 'Internal server error',
            method: 'GET',
            statusCode: 500,
            url: '/'
        })
    })
})
