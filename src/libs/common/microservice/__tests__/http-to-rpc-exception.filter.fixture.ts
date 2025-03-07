import { Controller, Get, NotFoundException, ValidationPipe } from '@nestjs/common'
import { APP_PIPE } from '@nestjs/core'
import { MessagePattern, MicroserviceOptions, NatsOptions, Transport } from '@nestjs/microservices'
import { IsNotEmpty, IsString } from 'class-validator'
import {
    createHttpTestContext,
    getNatsTestConnection,
    MicroserviceTestClient,
    withTestId
} from 'testlib'
import { ClientProxyModule, ClientProxyService, InjectClientProxy } from '../client-proxy.service'
import { HttpToRpcExceptionFilter } from '../http-to-rpc-exception.filter'

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
            app.useGlobalFilters(new HttpToRpcExceptionFilter())

            app.connectMicroservice<MicroserviceOptions>(brokerOptions, { inheritAppConfig: true })
            await app.startAllMicroservices()
        }
    })

    const client = MicroserviceTestClient.create(brokerOptions)

    const closeFixture = async () => {
        await client?.close()
        await testContext?.close()
    }

    return { testContext, closeFixture, client, httpClient: testContext.httpClient }
}
