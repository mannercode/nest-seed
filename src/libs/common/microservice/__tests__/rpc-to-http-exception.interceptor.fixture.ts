import { BadRequestException, Controller, Get, Module } from '@nestjs/common'
import { MessagePattern } from '@nestjs/microservices'
import { ClientProxyService, InjectClientProxy } from 'common'

@Controller()
class MicroserviceController {
    @MessagePattern('test.common.RpcToHttpExceptionInterceptor.throwHttpException')
    throwHttpException() {
        throw new BadRequestException('http exception')
    }

    @MessagePattern('test.common.RpcToHttpExceptionInterceptor.throwError')
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
        return this.client.send('test.common.RpcToHttpExceptionInterceptor.throwHttpException', {})
    }

    @Get('throwError')
    throwError() {
        return this.client.send('test.common.RpcToHttpExceptionInterceptor.throwError', {})
    }
}
