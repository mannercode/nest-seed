import { MicroserviceOptions, NatsOptions, Transport } from '@nestjs/microservices'
import { HttpToRpcExceptionFilter } from 'common'
import {
    createTestContext,
    getNatsTestConnection,
    MicroserviceTestClient,
    TestContext
} from 'testlib'
import { SampleModule } from './http-to-rpc-exception.filter.fixture'

describe('HttpToRpcExceptionFilter', () => {
    let testContext: TestContext
    let client: MicroserviceTestClient

    beforeEach(async () => {
        const { servers } = await getNatsTestConnection()

        const brokerOpts = { transport: Transport.NATS, options: { servers } } as NatsOptions

        testContext = await createTestContext({
            metadata: { imports: [SampleModule] },
            configureApp: async (app) => {
                app.useGlobalFilters(new HttpToRpcExceptionFilter())

                app.connectMicroservice<MicroserviceOptions>(brokerOpts, { inheritAppConfig: true })
                await app.startAllMicroservices()
            }
        })

        client = MicroserviceTestClient.create(brokerOpts)
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
