import {
    BadRequestException,
    Controller,
    Get,
    PayloadTooLargeException,
    UnauthorizedException
} from '@nestjs/common'
import { APP_FILTER } from '@nestjs/core'
import { MessagePattern, NatsOptions, Transport } from '@nestjs/microservices'
import { ClientProxyModule, ClientProxyService, HttpExceptionFilter } from 'common'
import { createHttpTestContext, getNatsTestConnection, withTestId } from 'testlib'

@Controller()
class TestController {
    @Get('bad-request')
    async throwHttpException() {
        throw new BadRequestException('throwHttpException')
    }

    @Get('error')
    async throwError() {
        throw new Error('test')
    }

    @Get('too-many-files')
    async tooManyFiles() {
        throw new BadRequestException('Too many files')
    }

    @Get('file-too-large')
    async fileTooLarge() {
        throw new PayloadTooLargeException('File too large')
    }

    @Get('unauthorized')
    async unauthorized() {
        throw new UnauthorizedException('Unauthorized')
    }

    @MessagePattern(withTestId('subject.throwException'))
    async throwRpcException() {
        throw new BadRequestException('throwRpcException')
    }
}

export async function createFixture() {
    const { servers } = getNatsTestConnection()
    const brokerOptions = { transport: Transport.NATS, options: { servers } } as NatsOptions

    const testContext = await createHttpTestContext({
        metadata: {
            imports: [
                ClientProxyModule.registerAsync({ name: 'name', useFactory: () => brokerOptions })
            ],
            controllers: [TestController],
            providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }]
        },
        configureApp: async (app) => {
            app.connectMicroservice(brokerOptions, { inheritAppConfig: true })
            await app.startAllMicroservices()
        }
    })

    const proxyService = testContext.module.get(ClientProxyService.getToken('name'))

    const closeFixture = async () => {
        await testContext?.close()
    }

    return { testContext, closeFixture, client: testContext.httpClient, proxyService }
}
