import { Controller, Get, NotFoundException, ValidationPipe } from '@nestjs/common'
import { APP_PIPE } from '@nestjs/core'
import { MessagePattern, MicroserviceOptions, NatsOptions, Transport } from '@nestjs/microservices'
import { IsNotEmpty, IsString } from 'class-validator'
import { createHttpTestContext, getNatsTestConnection, withTestId } from 'testlib'
import { ClientProxyModule, ClientProxyService, InjectClientProxy } from '../client-proxy.service'
import { RpcExceptionFilter } from '../rpc-exception.filter'

class CreateSampleDto {
    @IsString()
    @IsNotEmpty()
    name: string
}

@Controller()
class SampleController {
    constructor(@InjectClientProxy('name') private client: ClientProxyService) {}

    @MessagePattern(withTestId('subject.throwHttpException'))
    throwHttpException() {
        throw new NotFoundException('not found exception')
    }

    @MessagePattern(withTestId('subject.throwError'))
    throwError() {
        throw new Error('error message')
    }

    @MessagePattern(withTestId('subject.verifyDto'))
    verifyDto(createDto: CreateSampleDto) {
        return createDto
    }

    @Get('throwHttpException')
    getThrowHttpException() {
        throw new NotFoundException('not found exception')
    }
}

export async function createFixture() {
    const { servers } = await getNatsTestConnection()
    const brokerOptions = { transport: Transport.NATS, options: { servers } } as NatsOptions

    const testContext = await createHttpTestContext({
        metadata: {
            imports: [
                ClientProxyModule.registerAsync({ name: 'name', useFactory: () => brokerOptions })
            ],
            controllers: [SampleController],
            providers: [{ provide: APP_PIPE, useFactory: () => new ValidationPipe() }]
        },
        configureApp: async (app) => {
            app.useGlobalFilters(new RpcExceptionFilter())

            app.connectMicroservice<MicroserviceOptions>(brokerOptions, { inheritAppConfig: true })
            await app.startAllMicroservices()
        }
    })

    const proxyService = testContext.module.get(ClientProxyService.getToken('name'))

    const closeFixture = async () => {
        await testContext?.close()
    }

    return { testContext, closeFixture, httpClient: testContext.httpClient, proxyService }
}
