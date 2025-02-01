import { Controller, Module, NotFoundException, ValidationPipe } from '@nestjs/common'
import { APP_PIPE } from '@nestjs/core'
import { MessagePattern } from '@nestjs/microservices'
import { IsNotEmpty, IsString } from 'class-validator'

export class CreateSampleDto {
    @IsString()
    @IsNotEmpty()
    name: string
}

export const messages = {
    throwHttpException: 'test.common.HttpToRpcExceptionFilter.throwHttpException',
    rethrow: 'test.common.HttpToRpcExceptionFilter.rethrow',
    throwError: 'test.common.HttpToRpcExceptionFilter.throwError',
    createSample: 'test.common.HttpToRpcExceptionFilter.createSample'
}

@Controller()
class SampleController {
    constructor() {}

    @MessagePattern(messages.throwHttpException)
    throwHttpException() {
        throw new NotFoundException('not found exception')
    }

    @MessagePattern(messages.rethrow)
    rethrow() {
        throw { status: 400, response: { message: 'error message' } }
    }

    @MessagePattern(messages.throwError)
    throwError() {
        throw new Error('error')
    }

    @MessagePattern(messages.createSample)
    createSample(createDto: CreateSampleDto) {
        return createDto
    }
}

@Module({
    controllers: [SampleController],
    providers: [{ provide: APP_PIPE, useFactory: () => new ValidationPipe() }]
})
export class SampleModule {}
