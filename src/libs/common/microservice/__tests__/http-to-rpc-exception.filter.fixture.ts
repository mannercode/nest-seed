import { Controller, NotFoundException, ValidationPipe } from '@nestjs/common'
import { APP_PIPE } from '@nestjs/core'
import { MessagePattern, MicroserviceOptions, NatsOptions, Transport } from '@nestjs/microservices'
import { IsNotEmpty, IsString } from 'class-validator'
import {
    createTestContext,
    getNatsTestConnection,
    MicroserviceTestClient,
    withTestId
} from 'testlib'
import { HttpToRpcExceptionFilter } from '../http-to-rpc-exception.filter'

class CreateSampleDto {
    @IsString()
    @IsNotEmpty()
    name: string
}

@Controller()
class SampleController {
    constructor() {}

    @MessagePattern(withTestId('subject.throwHttpException'))
    throwHttpException() {
        throw new NotFoundException('not found exception')
    }

    @MessagePattern(withTestId('subject.rethrow'))
    rethrow() {
        throw { status: 400, response: { message: 'error message' } }
    }

    @MessagePattern(withTestId('subject.throwError'))
    throwError() {
        throw new Error('error')
    }

    @MessagePattern(withTestId('subject.createSample'))
    createSample(createDto: CreateSampleDto) {
        return createDto
    }
}

export async function createFixture() {
    const { servers } = await getNatsTestConnection()
    const brokerOptions = { transport: Transport.NATS, options: { servers } } as NatsOptions

    const testContext = await createTestContext({
        metadata: {
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

    return { testContext, closeFixture, client }
}
