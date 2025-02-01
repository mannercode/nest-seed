import { INestMicroservice } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { Transport } from '@nestjs/microservices'
import {
    ClientProxyModule,
    generateShortId,
    HttpToRpcExceptionFilter,
    RpcToHttpExceptionInterceptor
} from 'common'
import {
    createHttpTestContext,
    createMicroserviceTestContext,
    getKafkaTestConnection,
    HttpTestClient,
    HttpTestContext,
    MicroserviceTestContext
} from 'testlib'
import {
    HttpController,
    messages,
    MicroserviceModule
} from './rpc-to-http-exception.interceptor.fixture'

describe('RpcToHttpExceptionInterceptor', () => {
    let microContext: MicroserviceTestContext
    let httpContext: HttpTestContext
    let client: HttpTestClient

    beforeEach(async () => {
        microContext = await createMicroserviceTestContext(
            { imports: [MicroserviceModule] },
            (app: INestMicroservice) => app.useGlobalFilters(new HttpToRpcExceptionFilter())
        )

        httpContext = await createHttpTestContext({
            imports: [
                ClientProxyModule.registerAsync({
                    name: 'name',
                    useFactory: () => {
                        const { brokers } = getKafkaTestConnection()

                        return {
                            transport: Transport.KAFKA,
                            options: {
                                client: { brokers },
                                consumer: { groupId: generateShortId(), maxWaitTimeInMs: 0 }
                            }
                        }
                    },
                    messages: [messages.throwError, messages.throwHttpException]
                })
            ],
            controllers: [HttpController],
            providers: [{ provide: APP_INTERCEPTOR, useClass: RpcToHttpExceptionInterceptor }]
        })
        client = httpContext.client
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
