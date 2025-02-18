import { HttpTestClient, TestContext } from 'testlib'

describe('RpcToHttpExceptionInterceptor', () => {
    let microContext: TestContext
    let httpContext: TestContext
    let client: HttpTestClient

    beforeEach(async () => {
        const { createFixture } = await import('./rpc-to-http-exception.interceptor.fixture')
        const fixture = await createFixture()

        microContext = fixture.microContext
        httpContext = fixture.httpContext
        client = fixture.client
    })

    afterEach(async () => {
        await httpContext?.close()
        await microContext?.close()
    })

    it('should return BAD_REQUEST(400) status', async () => {
        await client.get('/throwHttpException').badRequest()
    })

    it('should return INTERNAL_SERVER_ERROR(500) status', async () => {
        await client.get('/throwError').internalServerError()
    })
})
