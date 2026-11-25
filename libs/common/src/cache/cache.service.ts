import {
    Injectable,
    InternalServerErrorException,
    ServiceUnavailableException
} from '@nestjs/common'
import type { RedisConnection } from '../redis/index.js'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { DateUtil, defaultTo } from '../utils/index.js'

@Injectable()
export class CacheService {
    constructor(
        private readonly redis: RedisConnection,
        private readonly prefix: string
    ) {}

    static getName(name?: string) {
        return `CacheService_${defaultTo(name, 'default')}`
    }

    async delete(key: string) {
        await this.redis.del(this.getKey(key))
    }

    async incrementWithExpiry(key: string, ttlMs: number): Promise<number> {
        if (!Number.isInteger(ttlMs)) {
            throw new InternalServerErrorException('Internal server error', {
                cause: 'Counter TTL must be an integer (ms)'
            })
        }

        const result = await this.redis.eval(
            `local count = redis.call('INCR', KEYS[1])
             if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
             return count`,
            1,
            this.getKey(key),
            ttlMs.toString()
        )
        return Number(result)
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
        if (!Number.isInteger(ttlMs) || ttlMs < 0) {
            throw new InternalServerErrorException('Internal server error', {
                cause: 'TTL must be a non-negative integer (0 for no expiration)'
            })
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
        if (!Number.isInteger(ttlMs) || ttlMs <= 0) {
            throw new InternalServerErrorException('Internal server error', {
                cause: 'Lock TTL must be a positive integer (ms)'
            })
        }

        const token = `${process.pid}:${DateUtil.toEpochMilliseconds(DateUtil.now())}:${randomUUID()}`
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

    // waitMs가 지나면 새 fn을 시작하지 않는다. 실행 중인 fn의 시간은 제한하지 않는다.
    // 락 획득 순서는 보장하지 않는다.
    async withLockBlocking<T>(
        key: string,
        ttlMs: number,
        fn: () => Promise<T> | T,
        {
            pollMs = 50,
            signal,
            waitMs = 2 * 60 * 1000
        }: { pollMs?: number; signal?: AbortSignal; waitMs?: number } = {}
    ): Promise<T> {
        const deadline = performance.now() + waitMs
        const remainingWaitMs = () => {
            const remaining = deadline - performance.now()
            if (remaining <= 0) {
                throw new ServiceUnavailableException('Service unavailable', {
                    cause: `withLockBlocking: could not acquire '${key}' within ${waitMs}ms`
                })
            }
            return remaining
        }

        for (;;) {
            signal?.throwIfAborted()
            remainingWaitMs()
            // SET 응답을 기다리는 동안 취소되거나 기한이 지났다면 획득한 락만 해제한다.
            const attempt = await this.withLock(key, ttlMs, () => {
                signal?.throwIfAborted()
                remainingWaitMs()
                return fn()
            })
            if (attempt.ran) return attempt.result
            await sleep(Math.min(pollMs, remainingWaitMs()), undefined, { signal })
        }
    }

    private getKey(key: string) {
        return `${this.prefix}:${key}`
    }
}
