import { Injectable } from '@nestjs/common'
import Redis from 'ioredis'
import { defaultTo } from '../utils'

@Injectable()
export class CacheService {
    constructor(
        private readonly redis: Redis,
        private readonly prefix: string
    ) {}

    static getName(name?: string) {
        return `CacheService_${defaultTo(name, 'default')}`
    }

    async delete(key: string) {
        await this.redis.del(this.getKey(key))
    }

    // 키에는 캐시 접두어를 붙이고 스크립트의 첫 ARGV에도 같은 접두어를 넘긴다.
    async executeScript<T = unknown>(
        script: string,
        keys: string[],
        scriptArgs: string[]
    ): Promise<T> {
        const result = await this.redis.eval(
            script,
            keys.length,
            ...keys.map(this.getKey.bind(this)),
            this.prefix,
            ...scriptArgs
        )
        return result as T
    }

    async get(key: string): Promise<null | string> {
        const value = await this.redis.get(this.getKey(key))
        return value
    }

    async set(key: string, value: string, ttlMs = 0) {
        if (ttlMs < 0) {
            throw new Error('TTL must be a non-negative integer (0 for no expiration)')
        }

        if (0 < ttlMs) {
            await this.redis.set(this.getKey(key), value, 'PX', ttlMs)
        } else {
            await this.redis.set(this.getKey(key), value)
        }
    }

    /**
     * 락 획득자만 `fn`을 실행하고 나머지는 `{ ran: false }`를 받는다.
     * `ttlMs`는 최대 실행 시간보다 길어야 하며, 소유 토큰이 일치할 때만 해제한다.
     */
    async withLock<T>(
        key: string,
        ttlMs: number,
        fn: () => Promise<T> | T
    ): Promise<{ ran: false } | { ran: true; result: T }> {
        if (ttlMs <= 0) throw new Error('Lock TTL must be a positive integer (ms)')

        const token = `${process.pid}:${Date.now()}:${Math.random()}`
        const lockKey = this.getKey(`lock:${key}`)
        const acquired = await this.redis.set(lockKey, token, 'PX', ttlMs, 'NX')

        if (acquired !== 'OK') return { ran: false }

        await using _release = {
            [Symbol.asyncDispose]: async () => {
                await this.redis.eval(
                    `
                    if redis.call('get', KEYS[1]) == ARGV[1] then
                        return redis.call('del', KEYS[1])
                    end
                    return 0
                    `,
                    1,
                    lockKey,
                    token
                )
            }
        }

        return { ran: true, result: await fn() }
    }

    // waitMs 동안 폴링하며 획득 순서는 보장하지 않는다.
    async withLockBlocking<T>(
        key: string,
        ttlMs: number,
        fn: () => Promise<T> | T,
        { pollMs = 50, waitMs = 2 * 60 * 1000 }: { pollMs?: number; waitMs?: number } = {}
    ): Promise<T> {
        const deadline = Date.now() + waitMs
        for (;;) {
            const attempt = await this.withLock(key, ttlMs, fn)
            if (attempt.ran) return attempt.result
            if (Date.now() >= deadline) {
                throw new Error(`withLockBlocking: could not acquire '${key}' within ${waitMs}ms`)
            }
            await new Promise((r) => setTimeout(r, pollMs))
        }
    }

    private getKey(key: string) {
        return `${this.prefix}:${key}`
    }
}
