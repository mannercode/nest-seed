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
     * 캐시 접두어가 붙은 키로 Lua 스크립트를 실행한다.
     * 캐시 접두어는 항상 첫 번째 ARGV로 들어가므로, 스크립트 안에서 접두어가 필요할 때 그대로 사용할 수 있다.
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
     * 이 캐시 범위 안에서만 동작하는 분산 락이다.
     * 같은 키를 획득한 호출자 한 명만 `fn`을 실행한다.
     * 동시에 들어온 다른 호출자는 `{ ran: false }`만 받는다.
     * 락은 `fn`이 끝나면(예외가 나도) 해제된다.
     *
     * - 락 키는 `${prefix}:lock:${key}`에 둔다.
     * - `ttlMs`는 `fn`의 최대 실행 시간보다 커야 한다.
     *   프로세스가 종료되어 락이 남으면 TTL이 다른 호출자가 대기하는 시간의 상한이 된다.
     * - 락을 획득할 때 만든 토큰과 일치할 때만 키를 지운다.
     *   그래서 만료된 뒤 다른 호출자가 다시 획득한 락을 실수로 해제하지 않는다.
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
     * `withLock`과 달리 락이 비워질 때까지 기다리는 변종이다.
     * 락을 획득하면 `fn`을 정확히 한 번 실행하고, `waitMs` 안에 획득하지 못하면 예외를 던진다.
     *
     * 들어온 요청을 무시하지 않고 한 번에 하나씩 처리해야 할 때 사용한다.
     * 폴링 방식이라 대기자 사이의 획득 순서는 보장하지 않는다.
     * `pollMs`는 해제된 락을 빠르게 획득할 만큼 짧게 두되, Redis 요청이 과도해지지 않을 정도로는 길게 둔다.
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
