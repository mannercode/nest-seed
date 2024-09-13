import { Controller, Get, Injectable, Module } from '@nestjs/common'

@Injectable()
export class SampleService {
    constructor() {}

    async getMessage() {
        throw new Error('This method should be mocked.')
    }
}

@Controller()
class SampleController {
    constructor(private service: SampleService) {}

    @Get()
    async getMessage() {
        return this.service.getMessage()
    }
}

@Module({
    controllers: [SampleController],
    providers: [SampleService]
})
export class SampleModule {}
