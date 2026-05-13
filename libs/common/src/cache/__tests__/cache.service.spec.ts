import type { CacheServiceFixture } from './cache.service.fixture'
import { sleep } from '../../utils'

describe('CacheService', () => {
    let fix: CacheServiceFixture

    beforeEach(async () => {
        const { createCacheServiceFixture } = await import('./cache.service.fixture')
        fix = await createCacheServiceFixture()
    })
    afterEach(() => fix.teardown())

    describe('set', () => {
        it('TTL이 없으면 값을 저장한다', async () => {
            await fix.cacheService.set('key', 'value')
            const cachedValue = await fix.cacheService.get('key')
            expect(cachedValue).toEqual('value')
        })

        it('TTL이 지나면 만료된다', async () => {
            const ttl = 1000
            await fix.cacheService.set('key', 'value', ttl)

            const beforeExpiration = await fix.cacheService.get('key')
            expect(beforeExpiration).toEqual('value')

            // TTL에 500ms 안전 마진을 더합니다. 짧은 TTL에서는 비례 마진(10%)이 부하 상황에 부족합니다.
            await sleep(ttl + 500)

            const afterExpiration = await fix.cacheService.get('key')
            expect(afterExpiration).toBeNull()
        })

        it('TTL이 0이면 만료되지 않는다', async () => {
            await fix.cacheService.set('key', 'value', 0)

            const beforeExpiration = await fix.cacheService.get('key')
            expect(beforeExpiration).toEqual('value')

            await sleep(1500)

            const afterExpiration = await fix.cacheService.get('key')
            expect(afterExpiration).toEqual('value')
        })

        it('TTL이 음수이면 예외를 던진다', async () => {
            await expect(fix.cacheService.set('key', 'value', -100)).rejects.toThrow(
                'TTL must be a non-negative integer (0 for no expiration)'
            )
        })
    })

    describe('delete', () => {
        it('저장된 값을 삭제한다', async () => {
            await fix.cacheService.set('key', 'value')

            const beforeDelete = await fix.cacheService.get('key')
            expect(beforeDelete).toEqual('value')

            await fix.cacheService.delete('key')

            const afterDelete = await fix.cacheService.get('key')
            expect(afterDelete).toBeNull()
        })
    })

    describe('executeScript', () => {
        it('스크립트를 실행하고 결과를 반환한다', async () => {
            const script = `return redis.call('SET', KEYS[1], ARGV[2])`
            const keys = ['key']
            const args = ['value']

            const result = await fix.cacheService.executeScript(script, keys, args)
            expect(result).toBe('OK')

            const storedValue = await fix.cacheService.get('key')
            expect(storedValue).toBe('value')
        })

        it('스크립트 실행이 실패하면 예외를 그대로 던진다', async () => {
            // 잘못된 Lua 스크립트이므로 Redis가 에러를 반환합니다.
            await expect(
                fix.cacheService.executeScript('this is not lua', [], [])
            ).rejects.toThrow()
        })
    })

    describe('withLock', () => {
        it('락을 점유한 동안에는 다른 호출이 콜백을 실행하지 않는다', async () => {
            let running = 0
            let maxConcurrent = 0
            let executedCount = 0

            const runners = Array.from({ length: 20 }, () =>
                fix.cacheService.withLock('job', 5_000, async () => {
                    running += 1
                    maxConcurrent = Math.max(maxConcurrent, running)
                    executedCount += 1
                    await sleep(20)
                    running -= 1
                })
            )

            const results = await Promise.all(runners)

            expect(maxConcurrent).toBe(1)
            expect(executedCount).toBe(results.filter((r) => r.ran).length)
            expect(results.filter((r) => r.ran)).toHaveLength(executedCount)
            expect(executedCount).toBeGreaterThanOrEqual(1)
        }, 30_000)

        it('만료된 락을 다른 호출자가 잡으면 원래 호출자의 해제가 새 락을 지우지 않는다', async () => {
            await fix.cacheService.set('lock:job', 'other-runner', 10_000)

            const result = await fix.cacheService.withLock('job', 5_000, async () => {
                throw new Error('should not run while another owner holds lock')
            })

            expect(result.ran).toBe(false)
            const value = await fix.cacheService.get('lock:job')
            expect(value).toBe('other-runner')
        })

        it('TTL이 0이면 예외를 던진다', async () => {
            await expect(fix.cacheService.withLock('job', 0, async () => null)).rejects.toThrow(
                'Lock TTL must be a positive integer (ms)'
            )
        })

        it('TTL이 음수이면 예외를 던진다', async () => {
            await expect(fix.cacheService.withLock('job', -100, async () => null)).rejects.toThrow(
                'Lock TTL must be a positive integer (ms)'
            )
        })

        it('콜백이 예외를 던져도 락을 해제한다', async () => {
            await expect(
                fix.cacheService.withLock('job', 5_000, () => {
                    throw new Error('boom')
                })
            ).rejects.toThrow('boom')

            const next = await fix.cacheService.withLock('job', 5_000, async () => 'ok')
            expect(next).toEqual({ ran: true, result: 'ok' })
        })

        it('콜백이 거부된 Promise를 반환해도 락을 해제한다', async () => {
            await expect(
                fix.cacheService.withLock('job', 5_000, async () => {
                    throw new Error('rejected')
                })
            ).rejects.toThrow('rejected')

            // 락이 해제되어 다음 호출이 즉시 획득할 수 있습니다.
            const next = await fix.cacheService.withLock('job', 5_000, async () => 'ok')
            expect(next).toEqual({ ran: true, result: 'ok' })
        })

        it('같은 프로세스에서 잇따라 락을 얻어도 토큰이 서로 다르다', async () => {
            // 두 번 연속 획득하고 해제하며 락 키 값이 매번 새로 생성되는지 확인합니다.
            await fix.cacheService.withLock('job', 5_000, async () => {})
            await fix.cacheService.withLock('job', 5_000, async () => {})

            // 락이 해제되었는지 확인합니다.
            const value = await fix.cacheService.get('lock:job')
            expect(value).toBeNull()
        })
    })

    describe('withLockBlocking', () => {
        it('경쟁이 없으면 즉시 실행된다', async () => {
            const result = await fix.cacheService.withLockBlocking('job', 5_000, async () => 42)
            expect(result).toBe(42)
        })

        it('동시 호출은 직렬화되어 모두 실행된다', async () => {
            let running = 0
            let maxConcurrent = 0
            const runnerCount = 10

            const runners = Array.from({ length: runnerCount }, (_, i) =>
                fix.cacheService.withLockBlocking(
                    'job',
                    5_000,
                    async () => {
                        running += 1
                        maxConcurrent = Math.max(maxConcurrent, running)
                        await sleep(20)
                        running -= 1
                        return i
                    },
                    { pollMs: 10 }
                )
            )

            const results = await Promise.all(runners)
            expect(results).toHaveLength(runnerCount)
            expect(new Set(results).size).toBe(runnerCount)
            expect(maxConcurrent).toBe(1)
        }, 30_000)

        it('대기 시간 안에 락을 못 잡으면 예외를 던진다', async () => {
            await fix.cacheService.set('lock:job', 'other', 10_000)

            await expect(
                fix.cacheService.withLockBlocking('job', 5_000, async () => 'unused', {
                    pollMs: 10,
                    waitMs: 50
                })
            ).rejects.toThrow(/could not acquire 'job'/)
        })

        it('waitMs가 경과하기 전에는 예외를 던지지 않는다', async () => {
            // 다른 보유자가 짧게 보유하다 해제하면 같은 호출이 락을 획득해 정상 동작합니다.
            await fix.cacheService.set('lock:job', 'other', 100)

            const start = Date.now()
            const result = await fix.cacheService.withLockBlocking('job', 5_000, async () => 42, {
                pollMs: 20,
                waitMs: 1000
            })
            const elapsed = Date.now() - start

            expect(result).toBe(42)
            expect(elapsed).toBeLessThan(1000)
        })

        it('pollMs가 0이어도 락 획득이 정상 동작한다', async () => {
            const result = await fix.cacheService.withLockBlocking('job', 5_000, async () => 1, {
                pollMs: 0
            })
            expect(result).toBe(1)
        })
    })

    describe('복구 경로', () => {
        it('Lua 스크립트가 실패한 뒤에도 같은 인스턴스의 다음 호출이 정상 동작한다', async () => {
            // executeScript가 한 번 실패해도 service 인스턴스는 손상되지 않습니다.
            await expect(
                fix.cacheService.executeScript('this is not lua', [], [])
            ).rejects.toThrow()

            // 다음 호출은 정상 동작합니다.
            await fix.cacheService.set('key', 'value')
            expect(await fix.cacheService.get('key')).toBe('value')
        })
    })
})
