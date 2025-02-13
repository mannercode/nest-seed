import { APP_INTERCEPTOR } from '@nestjs/core'
import { MicroserviceOptions, Transport } from '@nestjs/microservices'
import { ClientProxyModule, HttpToRpcExceptionFilter, RpcToHttpExceptionInterceptor } from 'common'
import express from 'express'
import { createNatsContainers, createTestContext, HttpTestClient, TestContext } from 'testlib'
import { HttpController, MicroserviceModule } from './rpc-to-http-exception.interceptor.fixture'

describe('RpcToHttpExceptionInterceptor', () => {
    let microContext: TestContext
    let httpContext: TestContext
    let client: HttpTestClient
    let closeNats: () => Promise<void>

    beforeEach(async () => {
        const { servers, close } = await createNatsContainers()
        closeNats = close

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

        httpContext = await createTestContext({
            metadata: {
                imports: [
                    ClientProxyModule.registerAsync({
                        name: 'name',
                        useFactory: () => ({ transport: Transport.NATS, options: { servers } })
                    })
                ],
                controllers: [HttpController],
                providers: [{ provide: APP_INTERCEPTOR, useClass: RpcToHttpExceptionInterceptor }]
            },
            configureApp: async (app) => {
                app.use(express.urlencoded({ extended: true }))
            }
        })

        client = new HttpTestClient(`http://localhost:${httpContext.httpPort}`)
    })

    afterEach(async () => {
        await httpContext?.close()
        await microContext?.close()
        await closeNats?.()
    })

    it('should return BAD_REQUEST(400) status', async () => {
        await client.get('/throwHttpException').badRequest()
    })

    it('should return INTERNAL_SERVER_ERROR(500) status', async () => {
        await client.get('/throwError').internalServerError()
    })
})
