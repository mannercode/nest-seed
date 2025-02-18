import { MicroserviceTestClient, TestContext } from 'testlib'

describe('HttpToRpcExceptionFilter', () => {
    let testContext: TestContext
    let client: MicroserviceTestClient

    beforeEach(async () => {
        const { createFixture } = await import('./http-to-rpc-exception.filter.fixture')
        const fixture = await createFixture()

        testContext = fixture.testContext
        client = MicroserviceTestClient.create(fixture.brokerOptions)
    })

    afterEach(async () => {
        await client?.close()
        await testContext?.close()
    })

    it('should handle HttpException properly for RPC', async () => {
        await client.error(
            'test.throwHttpException',
            {},
            {
                response: { error: 'Not Found', message: 'not found exception', statusCode: 404 },
                status: 404
            }
        )
    })

    it('should handle {status, response} properly for RPC', async () => {
        await client.error(
            'test.rethrow',
            {},
            { status: 400, response: { message: 'error message' } }
        )
    })

    it('should handle Error properly for RPC', async () => {
        await client.error('test.throwError', {}, { status: 500 })
    })

    it('should validate input and return error for incorrect data format', async () => {
        await client.error(
            'test.createSample',
            { wrong: 'wrong field' },
            {
                response: {
                    error: 'Bad Request',
                    message: ['name should not be empty', 'name must be a string'],
                    statusCode: 400
                },
                status: 400
            }
        )
    })
})
