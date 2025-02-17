import { APP_INTERCEPTOR } from '@nestjs/core'
import { MicroserviceOptions, Transport } from '@nestjs/microservices'
import { ClientProxyModule, HttpToRpcExceptionFilter, RpcToHttpExceptionInterceptor } from 'common'
import {
    createHttpTestContext,
    createTestContext,
    getNatsTestConnection,
    HttpTestClient,
    TestContext
} from 'testlib'
import { HttpController, MicroserviceModule } from './rpc-to-http-exception.interceptor.fixture'

describe('RpcToHttpExceptionInterceptor', () => {
    let microContext: TestContext
    let httpContext: TestContext
    let client: HttpTestClient

    beforeEach(async () => {
        const { servers } = await getNatsTestConnection()

        microContext = await createTestContext({
            metadata: { imports: [MicroserviceModule] },
            brokers: servers,
            configureApp: async (app, servers) => {
                app.useGlobalFilters(new HttpToRpcExceptionFilter())
                app.connectMicroservice<MicroserviceOptions>(
                    { transport: Transport.NATS, options: { servers } },
                    { inheritAppConfig: true }
                )
                await app.startAllMicroservices()
            }
        })

        httpContext = await createHttpTestContext({
            imports: [
                ClientProxyModule.registerAsync({
                    name: 'name',
                    useFactory: () => ({ transport: Transport.NATS, options: { servers } })
                })
            ],
            controllers: [HttpController],
            providers: [{ provide: APP_INTERCEPTOR, useClass: RpcToHttpExceptionInterceptor }]
        })

        client = new HttpTestClient(`http://localhost:${httpContext.httpPort}`)
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
