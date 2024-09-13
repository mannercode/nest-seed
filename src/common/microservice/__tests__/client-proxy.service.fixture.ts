import { Controller, Get, Module } from '@nestjs/common'
import { MessagePattern } from '@nestjs/microservices'
import { ClientProxyService } from '../client-proxy.service'

@Controller()
class MicroserviceController {
    @MessagePattern({ cmd: 'method' })
    async method() {
        return { result: 'success' }
    }
}

@Module({ controllers: [MicroserviceController] })
export class MicroserviceModule {}

@Controller('/')
export class HttpController {
    constructor(private client: ClientProxyService) {}

    @Get('send')
    send() {
        return this.client.send('method', {})
    }

    @Get('get')
    get() {
        return this.client.getValue('method', {})
    }
}
