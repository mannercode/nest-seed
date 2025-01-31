import { Controller, Get, Module, Param } from '@nestjs/common'

@Controller()
class SampleController {
    @Get('message/:arg')
    async getMessage(@Param('arg') arg: string) {
        return { received: arg }
    }
}

@Module({ controllers: [SampleController] })
export class SampleModule {}
