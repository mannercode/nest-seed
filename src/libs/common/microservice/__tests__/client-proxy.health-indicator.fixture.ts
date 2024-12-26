import { Controller, Get, Module } from '@nestjs/common'
import { MessagePattern } from '@nestjs/microservices'
import { ClientProxyService, InjectClientProxy } from 'common'

@Controller()
class MicroserviceController {
    @MessagePattern({ cmd: 'health' })
    method() {
        return { status: 'ok' }
    }
}

@Module({ controllers: [MicroserviceController] })
export class MicroserviceModule {}

@Controller('health')
export class HttpController {
    constructor(@InjectClientProxy('SERVICES') private client: ClientProxyService) {}

    @Get()
    health() {
        return this.client.send('health', {})
    }
}
