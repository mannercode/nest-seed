import { Controller, Module } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'

@Controller()
class SampleController {
    @MessagePattern('test.getMessage')
    getMessage(@Payload() request: { arg: string }) {
        return { id: request.arg }
    }
}

@Module({ controllers: [SampleController] })
export class SampleModule {}
