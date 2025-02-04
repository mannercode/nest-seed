import { Controller, Get, Module } from '@nestjs/common'
import { MessagePattern } from '@nestjs/microservices'
import { ClientProxyService, getProxyValue, InjectClientProxy } from 'common'

@Controller()
class MicroserviceController {
    @MessagePattern('test.common.ClientProxyService.method.*')
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
        return this.client.send('test.common.ClientProxyService.method', {})
    }

    @Get('value')
    getValue() {
        const observer = this.client.send('test.common.ClientProxyService.method')
        return getProxyValue(observer)
    }
}
