import { Controller, Get, Module } from '@nestjs/common'
import { MessagePattern } from '@nestjs/microservices'
import { ClientProxyService, getProxyValue, InjectClientProxy } from 'common'

export const messages = {
    method: 'test.common.ClientProxyService.method'
}

@Controller()
class MicroserviceController {
    @MessagePattern(messages.method)
    method() {
        return { result: 'success' }
    }
}

@Module({ controllers: [MicroserviceController] })
export class MicroserviceModule {}

@Controller()
export class HttpController {
    constructor(@InjectClientProxy('name') private client: ClientProxyService) {}

    @Get('observable')
    getObservable() {
        return this.client.send(messages.method, {})
    }

    @Get('value')
    getValue() {
        const observer = this.client.send(messages.method)
        return getProxyValue(observer)
    }
}
