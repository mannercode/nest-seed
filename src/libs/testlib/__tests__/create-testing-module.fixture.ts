import { Injectable, Module } from '@nestjs/common'

@Injectable()
export class SampleService {
    constructor() {}

    async getMessage(_arg: string) {
        return "이 코드는 실행되면 안 된다"
    }
}

@Module({ providers: [SampleService] })
export class SampleModule {}
