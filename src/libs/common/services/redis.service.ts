import { InjectRedis } from '@nestjs-modules/ioredis'
import { Inject, Injectable } from '@nestjs/common'
import { Exception } from 'common'
import Redis from 'ioredis'

@Injectable()
export class RedisService {
    constructor(
        @InjectRedis() private readonly redis: Redis,
        @Inject('PREFIX') private prefix: string
    ) {
        console.log('this.prefix', this.prefix)
    }

    async onModuleDestroy() {
        await this.redis.quit()
    }

    private makeKey(key: string) {
        return `${this.prefix}:${key}`
    }

    async set(key: string, value: string, milliseconds = 0) {
        if (milliseconds < 0) {
            throw new Exception('ttlMiliseconds should not be negative')
        }

        if (0 < milliseconds) {
            await this.redis.set(this.makeKey(key), value, 'PX', milliseconds)
        } else {
            await this.redis.set(this.makeKey(key), value)
        }
    }

    async get(key: string): Promise<string | null> {
        return this.redis.get(this.makeKey(key))
    }

    async delete(key: string) {
        await this.redis.del(this.makeKey(key))
    }
}
