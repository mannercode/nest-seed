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

    /**
     * namespacing 된 key 로 Lua script 를 실행한다.
     * cache prefix 는 항상 ARGV 의 첫 번째 값으로 들어간다.
     */
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
     * 이 cache 범위로 한정된 distributed lock. key 를 잡은 caller 한 명만
     * `fn` 을 실행하고, 동시 caller 는 `{ ran: false }` 를 받는다. lock 은
     * `fn` 이 끝나면 (throw 되어도) 해제된다. process 가 죽으면 TTL 이
     * key 가 막혀 있을 수 있는 시간의 상한이 된다.
     *
     * - lock key 는 `${prefix}:lock:${key}` 에 둔다
     * - ttlMs 는 `fn` 의 최악의 runtime 보다 커야 한다. crash 한 process 가
     *   다른 caller 를 굶길 수 있는 시간을 cap 한다
     * - owner (token 일치) 만 key 를 지우므로, 이미 만료되어 다른 peer 가
     *   다시 잡은 lock 을 덮어쓰지 않는다
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

    /**
     * `withLock` 의 blocking variant: lock 이 풀릴 때까지 polling 하다가
     * 잡으면 `fn` 을 정확히 한 번 실행한다. `waitMs` 안에 못 잡으면 throw
     * 한다.
     *
     * 경쟁 시 skip 하지 않고 다른 caller 와 직렬화해야 할 때 쓴다.
     * `pollMs` 는 풀린 lock 을 빠르게 잡을 수 있을 만큼 짧되, Redis 를
     * 두드려 패지 않을 정도로는 길게 잡는다.
     */
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
