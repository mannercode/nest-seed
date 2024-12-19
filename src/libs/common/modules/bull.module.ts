import {
    getQueueToken,
    BullModule as NestBullModule,
    SharedBullAsyncConfiguration
} from '@nestjs/bullmq'
import { Injectable, Module, OnModuleInit } from '@nestjs/common'
import { Queue } from 'bullmq'

@Injectable()
class BullInitService implements OnModuleInit {
    constructor(private queue: Queue) {}

    static getToken(name: string) {
        return `BullInitService_${name}`
    }

    async onModuleInit() {
        await this.queue.getActiveCount()
    }
}

@Module({})
export class BullModule {
    static forRootAsync(name: string, asyncBullConfig: SharedBullAsyncConfiguration) {
        return {
            module: BullModule,
            imports: [
                NestBullModule.forRootAsync(name, asyncBullConfig),
                NestBullModule.registerQueue({ configKey: name, name })
            ],
            providers: [
                {
                    provide: BullInitService.getToken(name),
                    useFactory: (queue: Queue) => new BullInitService(queue),
                    inject: [getQueueToken(name)]
                }
            ]
        }
    }
}
