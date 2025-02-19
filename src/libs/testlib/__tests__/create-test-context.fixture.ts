import { Controller, Get, Module, Param } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'

@Controller()
class SampleController {
    @MessagePattern('test.getMicroserviceMessage')
    getMicroserviceMessage(@Payload() request: { arg: string }) {
        return { id: request.arg }
    }

    @Get('message/:arg')
    async getHttpMessage(@Param('arg') arg: string) {
        return { received: arg }
    }
}

@Module({ controllers: [SampleController] })
export class SampleModule {}
