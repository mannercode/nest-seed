import { BadRequestException, Controller, Get, Module } from '@nestjs/common'
import { MessagePattern } from '@nestjs/microservices'
import { ClientProxyService, InjectClientProxy } from 'common'

export const messages = {
    throwHttpException: 'test.common.RpcToHttpExceptionInterceptor.throwHttpException',
    throwError: 'test.common.RpcToHttpExceptionInterceptor.throwError'
}

@Controller()
class MicroserviceController {
    @MessagePattern(messages.throwHttpException)
    throwHttpException() {
        throw new BadRequestException('http exception')
    }

    @MessagePattern(messages.throwError)
    throwError() {
        throw new Error('error message')
    }
}

@Module({ controllers: [MicroserviceController] })
export class MicroserviceModule {}

@Controller()
export class HttpController {
    constructor(@InjectClientProxy('name') private client: ClientProxyService) {}

    @Get('throwHttpException')
    throwHttpException() {
        return this.client.send(messages.throwHttpException, {})
    }

    @Get('throwError')
    throwError() {
        return this.client.send(messages.throwError, {})
    }
}
