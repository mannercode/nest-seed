import { CloseFixture, HttpTestClient } from 'testlib'

describe('RpcToHttpExceptionInterceptor', () => {
    let closeFixture: CloseFixture
    let client: HttpTestClient

    beforeEach(async () => {
        const { createFixture } = await import('./rpc-to-http-exception.interceptor.fixture')

        const fixture = await createFixture()
        closeFixture = fixture.closeFixture
        client = fixture.client
    })

    afterEach(async () => {
        await closeFixture?.()
    })

    it('BAD_REQUEST(400) 상태를 반환해야 한다', async () => {
        await client.get('/throwHttpException').badRequest()
    })

    it('INTERNAL_SERVER_ERROR(500) 상태를 반환해야 한다', async () => {
        await client.get('/throwError').internalServerError()
    })
})
