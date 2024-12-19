import { getQueueToken, BullModule as NestBullModule } from '@nestjs/bullmq'
import { Injectable, Module, OnModuleInit } from '@nestjs/common'
import { Queue } from 'bullmq'
import Redis from 'ioredis'
import { RedisModule } from './redis.module'

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

type BullFactory = { prefix: string }

@Module({})
export class BullModule {
    static forRootAsync(options: {
        name: string
        redisName: string
        useFactory: (...args: any[]) => Promise<BullFactory> | BullFactory
        inject?: any[]
    }) {
        const { name, redisName, useFactory, inject } = options

        return {
            module: BullModule,
            imports: [
                NestBullModule.forRootAsync(name, {
                    useFactory: async (redis: Redis, ...args: any[]) => {
                        const { prefix } = await useFactory(...args)
                        return { prefix, connection: redis }
                    },
                    inject: [RedisModule.getToken(redisName), ...(inject ?? [])]
                }),
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
