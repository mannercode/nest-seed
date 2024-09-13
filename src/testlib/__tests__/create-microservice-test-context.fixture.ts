import { Controller, Injectable, Module } from '@nestjs/common'
import { MessagePattern } from '@nestjs/microservices'

@Injectable()
export class SampleService {
    constructor() {}

    async getMessage(_arg: string) {
        throw new Error('This method should be mocked.')
    }
}

@Controller()
class SampleController {
    constructor(private service: SampleService) {}

    @MessagePattern({ cmd: 'getMessage' })
    async getMessage(arg: string) {
        return this.service.getMessage(arg)
    }
}

@Module({
    controllers: [SampleController],
    providers: [SampleService]
})
export class SampleModule {}
