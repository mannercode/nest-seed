import { BadRequestException, Controller, Get, Inject, Module } from '@nestjs/common'
import { ClientProxy, MessagePattern } from '@nestjs/microservices'

@Controller()
class MicroserviceController {
    @MessagePattern({ cmd: 'throwHttpException' })
    throwHttpException() {
        throw new BadRequestException('not found exception')
    }

    @MessagePattern({ cmd: 'throwError' })
    throwError() {
        throw new Error('error message')
    }
}

@Module({ controllers: [MicroserviceController] })
export class MicroserviceModule {}

@Controller()
export class HttpController {
    constructor(@Inject('SERVICES') private client: ClientProxy) {}

    @Get('throwHttpException')
    throwHttpException() {
        return this.client.send({ cmd: 'throwHttpException' }, {})
    }

    @Get('throwError')
    throwError() {
        return this.client.send({ cmd: 'throwError' }, {})
    }
}
