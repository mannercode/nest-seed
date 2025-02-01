import { Controller, Module } from '@nestjs/common'
import { Ctx, KafkaContext, MessagePattern, Payload } from '@nestjs/microservices'

// TODO 로거도 붙여야 한다.
@Controller()
class SampleController {
    @MessagePattern('test.testlib.getMessage')
    getMessage(@Payload() arg: string, @Ctx() _ctx: KafkaContext) {
        return { received: arg }
    }
}

@Module({ controllers: [SampleController] })
export class SampleModule {}
