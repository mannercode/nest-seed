import { BadRequestException, Controller, Get } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { MessagePattern, MicroserviceOptions, Transport } from '@nestjs/microservices'
import {
    ClientProxyModule,
    ClientProxyService,
    HttpToRpcExceptionFilter,
    InjectClientProxy,
    RpcToHttpExceptionInterceptor
} from 'common'
import {
    createHttpTestContext,
    createTestContext,
    getNatsTestConnection,
    HttpTestClient,
    withTestId
} from 'testlib'

@Controller()
class MicroserviceController {
    @MessagePattern(withTestId('subject.throwHttpException'))
    throwHttpException() {
        throw new BadRequestException('http exception')
    }

    @MessagePattern(withTestId('subject.throwError'))
    throwError() {
        throw new Error('error message')
    }
}

@Controller()
class HttpController {
    constructor(@InjectClientProxy('name') private client: ClientProxyService) {}

    @Get('throwHttpException')
    throwHttpException() {
        return this.client.send(withTestId('subject.throwHttpException'), {})
    }

    @Get('throwError')
    throwError() {
        return this.client.send(withTestId('subject.throwError'), {})
    }
}

export async function createFixture() {
    const { servers } = await getNatsTestConnection()

    const microContext = await createTestContext({
        metadata: { controllers: [MicroserviceController] },
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

    const httpContext = await createHttpTestContext({
        imports: [
            ClientProxyModule.registerAsync({
                name: 'name',
                useFactory: () => ({ transport: Transport.NATS, options: { servers } })
            })
        ],
        controllers: [HttpController],
        providers: [{ provide: APP_INTERCEPTOR, useClass: RpcToHttpExceptionInterceptor }]
    })
    const client = new HttpTestClient(httpContext.httpPort)

    const closeFixture = async () => {
        await httpContext?.close()
        await microContext?.close()
    }

    return { closeFixture, microContext, httpContext, client }
}
