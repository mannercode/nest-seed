import { INestMicroservice } from '@nestjs/common'
import { HttpToRpcExceptionFilter } from 'common'
import {
    createMicroserviceTestContext,
    createNatsContainers,
    MicroserviceTestClient,
    MicroserviceTestContext
} from 'testlib'
import { SampleModule } from './http-to-rpc-exception.filter.fixture'

describe('HttpToRpcExceptionFilter', () => {
    let testContext: MicroserviceTestContext
    let client: MicroserviceTestClient
    let closeNats: () => Promise<void>

    beforeEach(async () => {
        const { servers, close } = await createNatsContainers()
        closeNats = close

        testContext = await createMicroserviceTestContext({
            metadata: { imports: [SampleModule] },
            nats: { servers },
            configureApp: (app: INestMicroservice) =>
                app.useGlobalFilters(new HttpToRpcExceptionFilter())
        })
        client = testContext.client
    })

    afterEach(async () => {
        await testContext?.close()
        await closeNats?.()
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
