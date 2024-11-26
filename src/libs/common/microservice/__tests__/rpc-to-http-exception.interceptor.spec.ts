import { APP_INTERCEPTOR } from '@nestjs/core'
import { ClientsModule, Transport } from '@nestjs/microservices'
import {
    HttpTestClient,
    HttpTestContext,
    MicroserviceTestContext,
    createHttpTestContext,
    createMicroserviceTestContext
} from 'testlib'
import { RpcToHttpExceptionInterceptor } from 'common'
import { HttpController, MicroserviceModule } from './rpc-to-http-exception.interceptor.fixture'

describe('RpcToHttpExceptionInterceptor', () => {
    let microContext: MicroserviceTestContext
    let httpContext: HttpTestContext
    let client: HttpTestClient

    beforeEach(async () => {
        microContext = await createMicroserviceTestContext({ imports: [MicroserviceModule] })

        httpContext = await createHttpTestContext({
            imports: [
                ClientsModule.registerAsync([
                    {
                        name: 'SERVICES',
                        useFactory: () => ({
                            transport: Transport.TCP,
                            options: { host: '0.0.0.0', port: microContext.port }
                        })
                    }
                ])
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
