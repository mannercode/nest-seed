import { Controller, Module } from '@nestjs/common'
import { Ctx, MessagePattern, NatsContext, Payload } from '@nestjs/microservices'

class ResponseDto {
    id: string
}

export class RequestDto {
    arg: string
}

@Controller()
class SampleController {
    @MessagePattern('test.testlib.getMessage.*')
    getMessage(@Payload() request: RequestDto, @Ctx() _ctx: NatsContext) {
        const dto = new ResponseDto()
        dto.id = request.arg

        return dto
    }
}

@Module({ controllers: [SampleController] })
export class SampleModule {}
