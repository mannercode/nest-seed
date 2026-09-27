import { InternalServerErrorException } from '@nestjs/common'
import { type CacheServiceFixture, createCacheServiceFixture } from './cache.service.fixture.js'
import { sleep } from '../../utils/index.js'

describe('CacheService', () => {
    let fix: CacheServiceFixture

    beforeEach(async () => {
        fix = await createCacheServiceFixture()
    })
    afterEach(() => fix.teardown())

    describe('incrementWithExpiry', () => {
        describe('기존 카운터가 저장되어 있으면', () => {
            beforeEach(async () => {
                await fix.cacheService.set('existing-counter', '7')
            })
            describe.each([NaN, Infinity, -Infinity, 0.5])(
                'TTL이 유효하지 않은 값 %s이면',
                (ttl) => {
                    let expiry: number
                    beforeEach(() => {
                        expiry = ttl
                    })
                    it('카운터를 증가시키면 예외를 던지고 새 카운터를 만들거나 기존 값을 바꾸지 않는다', async () => {
                        await expect(
                            fix.cacheService.incrementWithExpiry('invalid-counter', expiry)
                        ).rejects.toThrow(
                            expect.objectContaining({
                                status: 500,
                                cause: 'Counter TTL must be an integer (ms)'
                            })
                        )
                        expect(await fix.cacheService.get('invalid-counter')).toBeNull()

                        await expect(
                            fix.cacheService.incrementWithExpiry('existing-counter', expiry)
                        ).rejects.toThrow(InternalServerErrorException)
                        expect(await fix.cacheService.get('existing-counter')).toBe('7')
                    })
                }
            )
        })

        describe.each([0, -1])('TTL이 %s밀리초이면', (ttl) => {
            let expiry: number
            beforeEach(() => {
                expiry = ttl
            })
            it('카운터를 증가시키면 증가한 값을 반환하고 즉시 만료시킨다', async () => {
                expect(
                    await fix.cacheService.incrementWithExpiry('immediate-counter', expiry)
                ).toBe(1)
                expect(await fix.cacheService.get('immediate-counter')).toBeNull()
            })
        })

        it('동시 증가가 유실되지 않고 최초 증가 때 만료를 설정한다', async () => {
            const results = await Promise.all(
                Array.from({ length: 20 }, () =>
                    fix.cacheService.incrementWithExpiry('counter', 10_000)
                )
            )
            expect(results.sort((a, b) => a - b)).toEqual(
                Array.from({ length: 20 }, (_, i) => i + 1)
            )
            expect(await fix.cacheService.get('counter')).toBe('20')
            const ttl = await fix.cacheService.executeScript(
                "return redis.call('PTTL', KEYS[1])",
                ['counter'],
                []
            )
            expect(ttl).toBeGreaterThan(0)
            expect(ttl).toBeLessThanOrEqual(10_000)
        })

        describe('만료 시간이 10초인 카운터가 존재하면', () => {
            beforeEach(async () => {
                await fix.cacheService.incrementWithExpiry('counter', 10_000)
            })
            describe('증가 요청의 TTL이 60초이면', () => {
                let expiry: number
                beforeEach(() => {
                    expiry = 60_000
                })
                it('카운터를 증가시켜도 기존 만료 시간을 연장하지 않는다', async () => {
                    expect(await fix.cacheService.incrementWithExpiry('counter', expiry)).toBe(2)
                    const ttl = await fix.cacheService.executeScript(
                        "return redis.call('PTTL', KEYS[1])",
                        ['counter'],
                        []
                    )
                    expect(ttl).toBeGreaterThan(0)
                    expect(ttl).toBeLessThanOrEqual(10_000)
                })
            })
        })
    })

    describe('set', () => {
        describe('기존 값이 저장되어 있으면', () => {
            beforeEach(async () => {
                await fix.cacheService.set('key', 'original')
            })
            describe.each([NaN, Infinity, -Infinity, 0.5])(
                'TTL이 유효하지 않은 값 %s이면',
                (ttl) => {
                    let expiry: number
                    beforeEach(() => {
                        expiry = ttl
                    })
                    it('값을 저장하면 예외를 던지고 기존 값을 유지한다', async () => {
                        await expect(
                            fix.cacheService.set('key', 'replacement', expiry)
                        ).rejects.toThrow(
                            expect.objectContaining({
                                status: 500,
                                cause: 'TTL must be a non-negative integer (0 for no expiration)'
                            })
                        )
                        expect(await fix.cacheService.get('key')).toBe('original')
                    })
                }
            )
        })

        describe('TTL을 지정하지 않았으면', () => {
            let input: Parameters<typeof fix.cacheService.set>
            beforeEach(() => {
                input = ['key', 'value']
            })
            it('값을 저장하면 다시 조회할 수 있다', async () => {
                await fix.cacheService.set(...input)
                const cachedValue = await fix.cacheService.get('key')
                expect(cachedValue).toEqual('value')
            })
        })

        describe('TTL이 1초이면', () => {
            let ttl: number
            let input: Parameters<typeof fix.cacheService.set>[2]
            beforeEach(() => {
                ttl = 1000
                input = ttl
            })
            it('값을 저장하고 TTL이 지나면 조회할 수 없다', async () => {
                await fix.cacheService.set('key', 'value', input)

                const beforeExpiration = await fix.cacheService.get('key')
                expect(beforeExpiration).toEqual('value')

                // TTL에 500ms 안전 마진을 더한다. 짧은 TTL에서는 비례 마진(10%)이 부하 상황에 부족하다.
                await sleep(ttl + 500)

                const afterExpiration = await fix.cacheService.get('key')
                expect(afterExpiration).toBeNull()
            })
        })

        describe('TTL이 0이면', () => {
            let input: Parameters<typeof fix.cacheService.set>[2]
            beforeEach(() => {
                input = 0
            })
            it('값을 저장하면 1.5초 뒤에도 조회할 수 있다', async () => {
                await fix.cacheService.set('key', 'value', input)

                const beforeExpiration = await fix.cacheService.get('key')
                expect(beforeExpiration).toEqual('value')

                await sleep(1500)

                const afterExpiration = await fix.cacheService.get('key')
                expect(afterExpiration).toEqual('value')
            })
        })

        describe('TTL이 음수이면', () => {
            let input: Parameters<typeof fix.cacheService.set>[2]
            beforeEach(() => {
                input = -100
            })
            it('값을 저장하면 예외를 던진다', async () => {
                await expect(fix.cacheService.set('key', 'value', input)).rejects.toThrow(
                    expect.objectContaining({
                        status: 500,
                        cause: 'TTL must be a non-negative integer (0 for no expiration)'
                    })
                )
            })
        })
    })

    describe('delete', () => {
        describe('저장된 값이 존재하면', () => {
            beforeEach(async () => {
                await fix.cacheService.set('key', 'value')

                const beforeDelete = await fix.cacheService.get('key')
                expect(beforeDelete).toEqual('value')
            })
            it('삭제하면 해당 키를 조회할 수 없다', async () => {
                await fix.cacheService.delete('key')

                const afterDelete = await fix.cacheService.get('key')
                expect(afterDelete).toBeNull()
            })
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

        describe('Lua 스크립트의 문법이 잘못되었으면', () => {
            let input: Parameters<typeof fix.cacheService.executeScript>[0]
            beforeEach(() => {
                input = 'this is not lua'
            })
            it('스크립트를 실행하면 예외를 그대로 던진다', async () => {
                await expect(fix.cacheService.executeScript(input, [], [])).rejects.toThrow()
            })
        })
    })

    describe('withLock', () => {
        describe.each([NaN, Infinity, -Infinity, 0.5])('TTL이 유효하지 않은 값 %s이면', (ttl) => {
            let callback: ReturnType<typeof vi.fn<() => string>>
            let expiry: number
            beforeEach(() => {
                callback = vi.fn(() => 'unused')
                expiry = ttl
            })
            it('락 획득을 요청하면 락을 만들거나 콜백을 실행하기 전에 예외를 던진다', async () => {
                await expect(fix.cacheService.withLock('job', expiry, callback)).rejects.toThrow(
                    expect.objectContaining({
                        status: 500,
                        cause: 'Lock TTL must be a positive integer (ms)'
                    })
                )
                expect(callback).not.toHaveBeenCalled()
                expect(await fix.cacheService.get('lock:job')).toBeNull()
            })
        })

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
            expect(executedCount).toBeGreaterThanOrEqual(1)
        }, 30_000)

        describe('다른 호출자가 락을 점유했으면', () => {
            beforeEach(async () => {
                await fix.cacheService.set('lock:job', 'other-runner', 10_000)
            })
            it('락 획득을 요청해도 실행하지 않고 기존 락을 유지한다', async () => {
                const result = await fix.cacheService.withLock('job', 5_000, async () => {
                    throw new Error('should not run while another owner holds lock')
                })

                expect(result.ran).toBe(false)
                const value = await fix.cacheService.get('lock:job')
                expect(value).toBe('other-runner')
            })
        })

        it('만료된 락을 다른 호출자가 잡으면 원래 호출자의 해제가 새 락을 지우지 않는다', async () => {
            const ttl = 1000

            const result = await fix.cacheService.withLock('job', ttl, async () => {
                // TTL에 500ms 안전 마진을 더해 콜백이 락보다 오래 살아남는 상황을 만든다.
                await sleep(ttl + 500)
                expect(await fix.cacheService.get('lock:job')).toBeNull()

                // 만료로 비워진 자리를 다른 호출자가 새로 잡는다.
                await fix.cacheService.set('lock:job', 'other-runner', 10_000)
            })

            // 콜백이 끝나면 원래 호출자의 해제가 실행되지만, 토큰이 달라 새 락은 남는다.
            expect(result.ran).toBe(true)
            const value = await fix.cacheService.get('lock:job')
            expect(value).toBe('other-runner')
        })

        describe('TTL이 0이면', () => {
            let input: Parameters<typeof fix.cacheService.withLock>[1]
            beforeEach(() => {
                input = 0
            })
            it('락 획득을 요청하면 예외를 던진다', async () => {
                await expect(
                    fix.cacheService.withLock('job', input, async () => null)
                ).rejects.toThrow(
                    expect.objectContaining({
                        status: 500,
                        cause: 'Lock TTL must be a positive integer (ms)'
                    })
                )
            })
        })

        describe('TTL이 음수이면', () => {
            let input: Parameters<typeof fix.cacheService.withLock>[1]
            beforeEach(() => {
                input = -100
            })
            it('락 획득을 요청하면 예외를 던진다', async () => {
                await expect(
                    fix.cacheService.withLock('job', input, async () => null)
                ).rejects.toThrow(
                    expect.objectContaining({
                        status: 500,
                        cause: 'Lock TTL must be a positive integer (ms)'
                    })
                )
            })
        })

        describe('콜백이 예외를 던지도록 설정하면', () => {
            let callback: Parameters<typeof fix.cacheService.withLock>[2]
            beforeEach(() => {
                callback = () => {
                    throw new Error('boom')
                }
            })
            it('락을 획득해 실행하면 예외를 전달하고 락을 해제한다', async () => {
                await expect(fix.cacheService.withLock('job', 5_000, callback)).rejects.toThrow(
                    'boom'
                )

                const next = await fix.cacheService.withLock('job', 5_000, async () => 'ok')
                expect(next).toEqual({ ran: true, result: 'ok' })
            })
        })

        describe('콜백이 거부된 Promise를 반환하도록 설정하면', () => {
            let callback: Parameters<typeof fix.cacheService.withLock>[2]
            beforeEach(() => {
                callback = async () => {
                    throw new Error('rejected')
                }
            })
            it('락을 획득해 실행하면 예외를 전달하고 락을 해제한다', async () => {
                await expect(fix.cacheService.withLock('job', 5_000, callback)).rejects.toThrow(
                    'rejected'
                )

                // 락이 해제되어 다음 호출이 즉시 획득할 수 있다.
                const next = await fix.cacheService.withLock('job', 5_000, async () => 'ok')
                expect(next).toEqual({ ran: true, result: 'ok' })
            })
        })

        it('같은 프로세스에서 잇따라 락을 얻어도 토큰이 서로 다르다', async () => {
            // 락을 쥔 동안 락 키에 저장된 값이 이번 획득의 토큰이다.
            const captureToken = () =>
                fix.cacheService.withLock('job', 5_000, () => fix.cacheService.get('lock:job'))

            const first = await captureToken()
            const second = await captureToken()

            expect(first).toEqual({ ran: true, result: expect.any(String) })
            expect(second).toEqual({ ran: true, result: expect.any(String) })
            expect(first).not.toEqual(second)
        })
    })

    describe('withLockBlocking', () => {
        describe('경과 시간을 조절할 수 있으면', () => {
            let now: number

            beforeEach(() => {
                now = 0
                vi.spyOn(performance, 'now').mockImplementation(() => now)
            })

            describe('waitMs가 0이면', () => {
                let input: Parameters<typeof fix.cacheService.withLockBlocking>[3]
                beforeEach(() => {
                    input = { waitMs: 0 }
                })
                it('락 획득을 요청하면 시도와 콜백 실행 없이 503 예외를 던진다', async () => {
                    const set = vi.spyOn(fix.redis, 'set')
                    const runner = vi.fn(() => 'unused')

                    await expect(
                        fix.cacheService.withLockBlocking('job', 5_000, runner, input)
                    ).rejects.toThrow(expect.objectContaining({ status: 503 }))

                    expect(set).not.toHaveBeenCalled()
                    expect(runner).not.toHaveBeenCalled()
                })
            })

            describe.each([
                { label: '대기 기한에 도달하면', responseTime: 10 },
                { label: '대기 기한이 지나면', responseTime: 11 }
            ])('락 획득 응답을 받을 때 $label', ({ responseTime }) => {
                beforeEach(() => {
                    const set = fix.redis.set.bind(fix.redis)
                    vi.spyOn(fix.redis, 'set').mockImplementationOnce(async (...args) => {
                        const result = await set(...args)
                        now = responseTime
                        return result
                    })
                })

                it('콜백을 실행하지 않고 획득한 락을 해제한다', async () => {
                    const runner = vi.fn(() => 'unused')

                    await expect(
                        fix.cacheService.withLockBlocking('job', 5_000, runner, { waitMs: 10 })
                    ).rejects.toThrow(expect.objectContaining({ status: 503 }))

                    expect(runner).not.toHaveBeenCalled()
                    expect(await fix.cacheService.get('lock:job')).toBeNull()
                })
            })

            describe('다음 획득을 기다리는 동안 기한이 지나면', () => {
                beforeEach(async () => {
                    await fix.cacheService.set('lock:job', 'other', 10_000)
                    let firstAttemptFinished = false
                    vi.spyOn(performance, 'now').mockImplementation(() => {
                        const current = now
                        if (firstAttemptFinished) now = 10
                        return current
                    })
                    const set = fix.redis.set.bind(fix.redis)
                    vi.spyOn(fix.redis, 'set').mockImplementationOnce(async (...args) => {
                        const result = await set(...args)
                        await fix.cacheService.delete('lock:job')
                        firstAttemptFinished = true
                        return result
                    })
                })

                it('락이 비어 있어도 다시 획득하거나 콜백을 실행하지 않는다', async () => {
                    const runner = vi.fn(() => 'unused')

                    await expect(
                        fix.cacheService.withLockBlocking('job', 5_000, runner, {
                            pollMs: 0,
                            waitMs: 10
                        })
                    ).rejects.toThrow(expect.objectContaining({ status: 503 }))

                    expect(fix.redis.set).toHaveBeenCalledTimes(1)
                    expect(runner).not.toHaveBeenCalled()
                    expect(await fix.cacheService.get('lock:job')).toBeNull()
                })
            })

            it('기한 전에 시작한 콜백은 기한 뒤에 끝나도 결과를 반환한다', async () => {
                const result = await fix.cacheService.withLockBlocking(
                    'job',
                    5_000,
                    async () => {
                        now = 20
                        return 42
                    },
                    { waitMs: 10 }
                )

                expect(result).toBe(42)
                expect(await fix.cacheService.get('lock:job')).toBeNull()
            })
        })

        describe('경쟁 중인 락이 없으면', () => {
            let input: Parameters<typeof fix.cacheService.withLockBlocking>[0]
            beforeEach(() => {
                input = 'job'
            })
            it('락 획득을 요청하면 콜백을 실행하고 결과를 반환한다', async () => {
                const result = await fix.cacheService.withLockBlocking(input, 5_000, async () => 42)
                expect(result).toBe(42)
            })
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

        describe('다른 호출자가 락을 10초간 점유했으면', () => {
            beforeEach(async () => {
                await fix.cacheService.set('lock:job', 'other', 10_000)
            })
            describe('대기 기한이 50ms이면', () => {
                let input: Parameters<typeof fix.cacheService.withLockBlocking>[3]
                beforeEach(() => {
                    input = { pollMs: 10, waitMs: 50 }
                })
                it('락 획득을 요청하면 기한이 지난 뒤 503 예외를 던진다', async () => {
                    await expect(
                        fix.cacheService.withLockBlocking('job', 5_000, async () => 'unused', input)
                    ).rejects.toThrow(
                        expect.objectContaining({
                            status: 503,
                            cause: expect.stringMatching(/could not acquire 'job'/)
                        })
                    )
                })
            })

            it('락을 기다리는 중 취소하면 취소 오류를 던진다', async () => {
                const controller = new AbortController()
                const waiting = fix.cacheService.withLockBlocking(
                    'job',
                    5_000,
                    async () => 'unused',
                    { pollMs: 1000, signal: controller.signal }
                )

                setTimeout(() => controller.abort(new Error('activity cancelled')), 20)

                await expect(waiting).rejects.toThrow('The operation was aborted')
            })
        })

        describe('다른 호출자의 락이 100ms 뒤에 만료되면', () => {
            beforeEach(async () => {
                // 다른 보유자가 짧게 보유하다 해제하면 같은 호출이 락을 획득해 정상 동작한다.
                await fix.cacheService.set('lock:job', 'other', 100)
            })
            it('만료 후 락을 획득해 대기 기한 안에 결과를 반환한다', async () => {
                const start = performance.now()
                const result = await fix.cacheService.withLockBlocking(
                    'job',
                    5_000,
                    async () => 42,
                    { pollMs: 20, waitMs: 1000 }
                )
                const elapsed = performance.now() - start

                expect(result).toBe(42)
                expect(elapsed).toBeLessThan(1000)
            })
        })

        describe('다른 호출자의 락이 200ms 뒤에 만료되면', () => {
            beforeEach(async () => {
                // 락을 짧게 선점해 첫 시도를 실패시켜야 pollMs가 쓰이는 재시도 경로가 실행된다.
                await fix.cacheService.set('lock:job', 'other', 200)
            })
            describe('pollMs가 0이면', () => {
                let input: Parameters<typeof fix.cacheService.withLockBlocking>[3]
                beforeEach(() => {
                    input = { pollMs: 0 }
                })
                it('락 획득을 요청하면 기존 락 만료 후 콜백을 실행한다', async () => {
                    const result = await fix.cacheService.withLockBlocking(
                        'job',
                        5_000,
                        async () => 1,
                        input
                    )
                    expect(result).toBe(1)
                })
            })
        })

        describe('signal이 이미 취소되었으면', () => {
            let controller: AbortController
            let runner: ReturnType<typeof vi.fn<() => Promise<number>>>
            beforeEach(() => {
                controller = new AbortController()
                runner = vi.fn(async () => 1)
                controller.abort(new Error('activity cancelled'))
            })
            it('락 획득을 요청하면 콜백 실행 없이 취소 오류를 던진다', async () => {
                await expect(
                    fix.cacheService.withLockBlocking('job', 5_000, runner, {
                        signal: controller.signal
                    })
                ).rejects.toThrow('activity cancelled')
                expect(runner).not.toHaveBeenCalled()
            })
        })
    })

    describe('복구 경로', () => {
        describe('Lua 스크립트 실행이 실패했으면', () => {
            beforeEach(async () => {
                await expect(
                    fix.cacheService.executeScript('this is not lua', [], [])
                ).rejects.toThrow()
            })
            it('같은 인스턴스로 값을 저장하고 조회할 수 있다', async () => {
                await fix.cacheService.set('key', 'value')
                expect(await fix.cacheService.get('key')).toBe('value')
            })
        })
    })

    describe('prefix가 같고 name만 다른 캐시가 있으면', () => {
        it('각 캐시에 같은 키로 저장하면 서로의 값을 읽거나 덮어쓰지 않는다', async () => {
            await fix.cacheA.set('key', 'value-a')
            expect(await fix.cacheB.get('key')).toBeNull()

            // 반대 방향도 격리되고, 뒤에 쓴 값이 먼저 쓴 값을 덮지 않는다.
            await fix.cacheB.set('key', 'value-b')
            expect(await fix.cacheA.get('key')).toBe('value-a')
            expect(await fix.cacheB.get('key')).toBe('value-b')
        })
    })
})
