import { INestMicroservice } from '@nestjs/common'
import {
    createMicroserviceTestContext,
    MicroserviceTestClient,
    MicroserviceTestContext
} from 'testlib'
import { HttpToRpcExceptionFilter } from '../http-to-rpc-exception.filter'
import { SampleModule } from './http-to-rpc-exception.filter.fixture'

describe('HttpToRpcExceptionFilter', () => {
    let testContext: MicroserviceTestContext
    let client: MicroserviceTestClient

    beforeEach(async () => {
        testContext = await createMicroserviceTestContext(
            { imports: [SampleModule] },
            (app: INestMicroservice) => app.useGlobalFilters(new HttpToRpcExceptionFilter())
        )
        client = testContext.client
    })

    afterEach(async () => {
        await testContext?.close()
    })

    it('should handle HttpException properly for RPC', async () => {
        await client.error(
            'throwHttpException',
            {},
            {
                response: { error: 'Not Found', message: 'not found exception', statusCode: 404 },
                status: 404
            }
        )
    })

    it('should handle {status, response} properly for RPC', async () => {
        await client.error('rethrow', {}, { status: 400, response: { message: 'error message' } })
    })

    it('should handle Error properly for RPC', async () => {
        await client.error('throwError', {}, { status: 500 })
    })

    it('should validate input and return error for incorrect data format', async () => {
        await client.error(
            'createSample',
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
