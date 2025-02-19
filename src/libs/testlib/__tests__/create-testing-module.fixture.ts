import { Injectable, Module } from '@nestjs/common'

@Injectable()
export class SampleService {
    constructor() {}

    async getMessage() {
        return 'This method should not be called'
    }
}

@Module({ providers: [SampleService] })
export class SampleModule {}
