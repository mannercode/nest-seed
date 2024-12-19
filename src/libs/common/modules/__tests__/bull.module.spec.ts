import { getQueueToken, BullModule as NestBullModule } from '@nestjs/bullmq'
import { TestingModule } from '@nestjs/testing'
import { Queue } from 'bullmq'
import { BullModule, generateShortId, RedisModule } from 'common'
import { createTestingModule, getRedisTestConnection } from 'testlib'

describe('CacheService', () => {
    let module: TestingModule
    let queue: Queue

    beforeEach(async () => {
        const redisCtx = getRedisTestConnection()
        module = await createTestingModule({
            imports: [
                RedisModule.forRootAsync({ useFactory: () => redisCtx }, 'redis'),
                BullModule.forRootAsync({
                    name:'name',
                    redisName: 'redis',
                    useFactory: () => ({ prefix: `{queue:${generateShortId()}}` })
                }),
                NestBullModule.registerQueue({ configKey: 'name', name: 'queue' })
            ]
        })

        queue = module.get(getQueueToken('queue'))
    })

    afterEach(async () => {
        if (module) await module.close()
    })

    it('add a value in the queue', async () => {
        await queue.add('test', { key: 'test', value: 'test' })
    })
})
