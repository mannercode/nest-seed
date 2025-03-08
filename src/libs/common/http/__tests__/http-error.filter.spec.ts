import { CloseFixture, HttpTestClient } from 'testlib'

describe('HttpErrorFilter', () => {
    let closeFixture: CloseFixture
    let client: HttpTestClient

    beforeEach(async () => {
        const { createFixture } = await import('./http-error.filter.fixture')

        const fixture = await createFixture()
        closeFixture = fixture.closeFixture
        client = fixture.client
    })

    afterEach(async () => {
        await closeFixture?.()
    })

    it('Error를 던지면 INTERNAL_SERVER_ERROR(500)를 반환해야 한다', async () => {
        await client.get('/').internalServerError({
            message: 'Internal server error',
            statusCode: 500,
            request: { method: 'GET', url: '/' }
        })
    })
})
