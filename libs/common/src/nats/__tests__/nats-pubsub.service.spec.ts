import { setImmediate as nextTurn } from 'node:timers/promises'
import { connect, type NatsConnection } from '@nats-io/transport-node'
import { JetStreamApiCodes, JetStreamApiError, jetstreamManager } from '@nats-io/jetstream'
import type { MockInstance } from 'vitest'
import { withTestId } from '@mannercode/testing'
import { waitForCleanup } from '@mannercode/tools/vitest-helpers'
import * as testing from '@mannercode/testing'
import { ensure } from '#common/utils'
import {
    type NatsPubSubServiceFixture,
    createNatsPubSubServiceFixture
} from './nats-pubsub.service.fixture.js'
import { Injectable, Logger as NestLogger } from '@nestjs/common'
import {
    InjectNatsPubSub,
    getNatsConnectionToken,
    NatsModule,
    NatsPubSubModule,
    NatsPubSubService,
    JetStreamChannel,
    type DurableMessages,
    type DurableMessage
} from '#common/nats'

/**
 * 픽스처가 연결을 flush해 두므로 측정 구간에는 순수 메시지 왕복만 들어온다.
 * NatsPubSubService.subscribe()도 flush 후 반환하므로 구독과 발행 사이의 경합도 없다.
 * 500ms 초과는 실제 지연 회귀 신호로 본다.
 */
async function waitFor(predicate: () => boolean, timeoutMs = 500) {
    const start = performance.now()
    while (!predicate()) {
        if (performance.now() - start > timeoutMs) {
            throw new Error(`waitFor timed out after ${timeoutMs}ms`)
        }
        await new Promise((r) => setTimeout(r, 10))
    }
}

describe('NatsPubSubService', () => {
    let fix: NatsPubSubServiceFixture
    let subject: string

    beforeEach(async () => {
        fix = await createNatsPubSubServiceFixture()
        subject = withTestId('nats-pubsub')
    })
    afterEach(() => fix.teardown())

    describe('다른 서비스 인스턴스에 구독자가 등록되어 있으면', () => {
        let received: string[]
        beforeEach(async () => {
            received = []
            await fix.pubSubB.subscribe(subject, (msg) => received.push(msg))
        })
        it('메시지를 발행하면 그 구독자가 수신한다', async () => {
            await fix.pubSubA.publish(subject, 'hello')

            await waitFor(() => received.length > 0)
            expect(received).toEqual(['hello'])
        })
    })

    describe('같은 subject에 핸들러 두 개가 등록되어 있으면', () => {
        let firstHandler: (message: string) => void
        let received1: string[]
        let received2: string[]
        beforeEach(async () => {
            received1 = []
            received2 = []

            firstHandler = (msg) => {
                received1.push(msg)
            }
            await fix.pubSubB.subscribe(subject, firstHandler)
            await fix.pubSubB.subscribe(subject, (msg) => received2.push(msg))
        })
        it('메시지를 발행하면 두 핸들러가 모두 수신한다', async () => {
            await fix.pubSubA.publish(subject, 'payload')

            await waitFor(() => received1.length > 0 && received2.length > 0)

            expect(received1).toEqual(['payload'])
            expect(received2).toEqual(['payload'])
        })

        it('한 핸들러를 해제하고 발행하면 남은 핸들러만 메시지를 수신한다', async () => {
            await fix.pubSubB.unsubscribe(subject, firstHandler)

            await fix.pubSubA.publish(subject, 'still-listening')
            await waitFor(() => received2.length > 0)
            expect(received1).toEqual([])
            expect(received2).toEqual(['still-listening'])
        })
    })

    describe('구독 등록의 flush 응답이 지연되면', () => {
        let flush: NatsConnection['flush']
        let ready: ReturnType<typeof Promise.withResolvers<void>>
        beforeEach(async () => {
            const connection = fix.connectionB
            flush = connection.flush.bind(connection)
            ready = Promise.withResolvers<void>()
            vi.spyOn(connection, 'flush').mockImplementationOnce(async () => {
                await flush()
                await ready.promise
            })
        })
        it('동시에 구독해도 등록 순서대로 수신하고 같은 flush가 끝나야 두 구독이 완료된다', async () => {
            const received: string[] = []
            const completed: string[] = []
            const first = fix.pubSubB
                .subscribe(subject, () => received.push('first'))
                .then(() => completed.push('first'))
            const second = fix.pubSubB
                .subscribe(subject, () => received.push('second'))
                .then(() => completed.push('second'))

            try {
                await flush()
                expect(completed).toEqual([])
                await fix.pubSubA.publish(subject, 'while-preparing')
                await waitFor(() => received.length === 2)
                expect(received).toEqual(['first', 'second'])
                ready.resolve()
                await Promise.all([first, second])
                expect(completed).toEqual(['first', 'second'])
            } finally {
                ready.resolve()
                await Promise.all([first, second])
            }
        })
    })

    describe('첫 구독의 flush가 실패하면', () => {
        let failure: Error
        beforeEach(() => {
            const connection = fix.connectionB
            failure = new Error('SUB flush failed')
            vi.spyOn(connection, 'flush').mockRejectedValueOnce(failure)
        })
        it('동시 구독은 모두 실패하고 다음 구독은 메시지를 수신한다', async () => {
            const failedHandler = vi.fn()
            const results = await Promise.allSettled([
                fix.pubSubB.subscribe(subject, failedHandler),
                fix.pubSubB.subscribe(subject, failedHandler)
            ])
            expect(results).toEqual([
                { status: 'rejected', reason: failure },
                { status: 'rejected', reason: failure }
            ])

            const received: string[] = []
            await fix.pubSubB.subscribe(subject, (message) => received.push(message))
            await fix.pubSubA.publish(subject, 'after-failure')
            await waitFor(() => received.length === 1)
            expect(received).toEqual(['after-failure'])
            expect(failedHandler).not.toHaveBeenCalled()
        })
    })

    describe('구독자가 메시지를 한 번 수신했으면', () => {
        let received: string[]
        let handler: (message: string) => void
        beforeEach(async () => {
            received = []
            handler = (msg: string) => received.push(msg)

            await fix.pubSubB.subscribe(subject, handler)

            await fix.pubSubA.publish(subject, 'before-unsub')
            await waitFor(() => received.length > 0)
        })
        it('구독을 해제한 뒤 발행한 메시지는 수신하지 않는다', async () => {
            await fix.pubSubB.unsubscribe(subject, handler)

            await fix.pubSubA.publish(subject, 'after-unsub')
            await fix.drainReceivers()

            expect(received).toEqual(['before-unsub'])
        })
    })

    describe('구독을 등록한 서비스를 종료했으면', () => {
        let received: string[]
        beforeEach(async () => {
            received = []
            await fix.pubSubB.subscribe(subject, (msg) => received.push(msg))

            // 실제 배치에서는 연결을 전역 NatsModule이 소유하므로, 연결 종료 없이 서비스 destroy만으로 구독이 끊겨야 한다.
            await fix.pubSubB.onModuleDestroy()
        })
        it('다시 구독하면 종료 오류를 던진다', async () => {
            await expect(fix.pubSubB.subscribe(subject, vi.fn())).rejects.toThrow('stopping')
        })
        it('공유 연결로 메시지를 발행해도 종료한 서비스의 핸들러는 호출되지 않는다', async () => {
            await fix.pubSubA.publish(subject, 'after-destroy')
            await fix.drainReceivers()

            expect(received).toEqual([])
        })
    })

    describe('첫 핸들러의 처리가 끝나기 전에', () => {
        let entered: ReturnType<typeof Promise.withResolvers<void>>
        let release: ReturnType<typeof Promise.withResolvers<void>>
        let finished: ReturnType<typeof vi.fn<() => void>>
        let handler: ReturnType<typeof vi.fn<() => Promise<void>>>
        let stopping: Promise<void> | undefined
        let stopped: boolean
        beforeEach(async () => {
            entered = Promise.withResolvers<void>()
            release = Promise.withResolvers<void>()
            finished = vi.fn()
            stopping = undefined
            stopped = false
            handler = vi.fn(async () => {
                entered.resolve()
                await release.promise
                finished()
            })
            await fix.pubSubB.subscribe(subject, handler)
        })
        afterEach(async () => {
            release.resolve()
            await stopping
        })

        it('처리 중인 핸들러의 구독을 해제하고 종료해도 그 처리가 끝날 때까지 기다린다', async () => {
            await fix.pubSubA.publish(subject, 'in-flight')
            await entered.promise
            await fix.pubSubA.publish(subject, 'queued')
            await fix.pubSubB.unsubscribe(subject, handler)
            stopping = fix.pubSubB.onModuleDestroy().then(() => {
                stopped = true
            })
            // 이미 완료된 종료 훅의 then까지 실행한 뒤, handler 대기를 확인한다.
            await Promise.resolve()
            expect(stopped).toBe(false)
            expect(finished).not.toHaveBeenCalled()

            release.resolve()
            await stopping
            expect(finished).toHaveBeenCalledTimes(1)
            expect(handler).toHaveBeenCalledTimes(1)
        })

        describe('실행을 기다리는 다음 핸들러도 있으면', () => {
            let next: ReturnType<typeof vi.fn<() => void>>
            beforeEach(async () => {
                next = vi.fn()
                await fix.pubSubB.subscribe(subject, next)
            })

            it('메시지 처리 중 종료하면 진행 중 핸들러를 기다리고 다음 핸들러는 호출하지 않는다', async () => {
                await fix.pubSubA.publish(subject, 'in-flight')
                await entered.promise
                await fix.pubSubA.publish(subject, 'queued')
                stopping = fix.pubSubB.onModuleDestroy().then(() => {
                    stopped = true
                })
                // 이미 완료된 종료 훅의 then까지 실행한 뒤, handler 대기를 확인한다.
                await Promise.resolve()
                expect(stopped).toBe(false)
                expect(finished).not.toHaveBeenCalled()

                release.resolve()
                await stopping
                expect(finished).toHaveBeenCalledTimes(1)
                expect(handler).toHaveBeenCalledTimes(1)
                expect(next).not.toHaveBeenCalled()
            })
        })
    })

    describe('subject를 구독한 적이 없으면', () => {
        let subject: string
        beforeEach(() => {
            subject = 'never-subscribed'
        })
        it('구독 해제를 요청하면 오류 없이 완료한다', async () => {
            await expect(fix.pubSubB.unsubscribe(subject, () => {})).resolves.toBeUndefined()
        })
    })

    describe('다른 subject에만 구독자가 등록되어 있으면', () => {
        let otherSubject: string
        let received: string[]
        beforeEach(async () => {
            otherSubject = withTestId('other')
            received = []

            await fix.pubSubB.subscribe(otherSubject, (msg) => received.push(msg))
        })
        it('구독하지 않은 subject를 해제해도 기존 subject의 메시지는 수신한다', async () => {
            await fix.pubSubB.unsubscribe(subject, () => {})

            await fix.pubSubA.publish(otherSubject, 'survived')
            await waitFor(() => received.length > 0)
            expect(received).toEqual(['survived'])
        })
    })

    describe('두 인스턴스가 같은 큐 그룹으로 구독했으면', () => {
        let receivedA: string[]
        let receivedB: string[]
        beforeEach(async () => {
            receivedA = []
            receivedB = []
            const queue = withTestId('queue-group')

            await fix.pubSubA.subscribe(subject, (msg) => receivedA.push(msg), { queue })
            await fix.pubSubB.subscribe(subject, (msg) => receivedB.push(msg), { queue })
        })
        it('메시지를 발행하면 두 인스턴스 중 하나만 수신한다', async () => {
            await fix.pubSubA.publish(subject, 'queued')
            await waitFor(() => receivedA.length + receivedB.length > 0)
            await fix.drainReceivers()

            expect(receivedA.length + receivedB.length).toBe(1)
        })
    })

    describe('브로드캐스트 구독과 같은 큐 그룹의 구독 두 개가 등록되어 있으면', () => {
        let broadcastReceived: string[]
        let queueReceivedA: string[]
        let queueReceivedB: string[]
        beforeEach(async () => {
            broadcastReceived = []
            queueReceivedA = []
            queueReceivedB = []
            const queue = withTestId('mixed-queue-group')

            await fix.pubSubB.subscribe(subject, (msg) => broadcastReceived.push(msg))
            await fix.pubSubB.subscribe(subject, (msg) => queueReceivedB.push(msg), { queue })
            await fix.pubSubA.subscribe(subject, (msg) => queueReceivedA.push(msg), { queue })
        })
        it('메시지를 발행하면 브로드캐스트 구독자와 큐 구독자 하나가 수신한다', async () => {
            await fix.pubSubA.publish(subject, 'mixed')

            await waitFor(
                () =>
                    broadcastReceived.length === 1 &&
                    queueReceivedA.length + queueReceivedB.length === 1
            )
            await fix.drainReceivers()

            expect(broadcastReceived).toEqual(['mixed'])
            expect(queueReceivedA.length + queueReceivedB.length).toBe(1)
        })
    })

    describe('예외를 던지는 핸들러와 정상 핸들러가 등록되어 있으면', () => {
        let errorSpy: MockInstance
        let received: string[]
        beforeEach(async () => {
            errorSpy = vi.spyOn(NestLogger.prototype, 'error').mockImplementation(() => undefined)

            received = []

            await fix.pubSubB.subscribe(subject, async () => {
                throw new Error('boom')
            })
            await fix.pubSubB.subscribe(subject, (msg) => received.push(msg))
        })
        it('메시지를 두 번 발행하면 오류를 기록하면서 정상 핸들러에 모두 전달한다', async () => {
            await fix.pubSubA.publish(subject, 'after-throw')

            await waitFor(() => errorSpy.mock.calls.some((c) => String(c[0]).includes(subject)))

            await fix.pubSubA.publish(subject, 'next')
            await waitFor(() => received.length === 2)

            expect(received).toEqual(['after-throw', 'next'])
            errorSpy.mockRestore()
        })
    })

    describe('소비 중 이터레이터가 실패했으면', () => {
        let previous: ReturnType<typeof vi.fn<(message: string) => void>>
        let errors: MockInstance
        beforeEach(async () => {
            previous = vi.fn()
            const read = Promise.withResolvers<IteratorResult<never>>()
            const logged = Promise.withResolvers<void>()
            errors = vi
                .spyOn(NestLogger.prototype, 'error')
                .mockImplementation(() => logged.resolve())
            vi.spyOn(fix.connectionB, 'subscribe').mockReturnValueOnce({
                unsubscribe: vi.fn(),
                [Symbol.asyncIterator]: () => ({ next: () => read.promise })
            } as unknown as ReturnType<NatsConnection['subscribe']>)
            await fix.pubSubB.subscribe(subject, previous)
            read.reject(new Error('iterator boom'))
            await logged.promise
        })
        it('수신 오류를 한 번 기록한다', () => {
            expect(errors).toHaveBeenCalledTimes(1)
        })
        it('다시 구독하면 새 핸들러가 다음 발행을 수신한다', async () => {
            const received = Promise.withResolvers<string>()
            await fix.pubSubB.subscribe(subject, received.resolve)
            await fix.pubSubA.publish(subject, 'after-error')
            expect(await received.promise).toBe('after-error')
            expect(previous).not.toHaveBeenCalled()
        })
    })

    describe('서버의 구독 확인 전에 수신이 끝나면', () => {
        beforeEach(() => {
            vi.spyOn(fix.connectionB, 'subscribe').mockReturnValueOnce({
                unsubscribe: vi.fn(),
                [Symbol.asyncIterator]: async function* () {}
            } as unknown as ReturnType<NatsConnection['subscribe']>)
        })
        it('구독 요청에 종료 오류를 전달한다', async () => {
            await expect(fix.pubSubB.subscribe(subject, vi.fn())).rejects.toThrow(
                'ended before it was ready'
            )
        })
    })

    describe('subject의 마지막 핸들러를 해제했으면', () => {
        let handler: () => void
        beforeEach(async () => {
            handler = () => {}
            await fix.pubSubB.subscribe(subject, handler)
            await fix.pubSubB.unsubscribe(subject, handler)
        })
        it('다시 구독한 뒤 발행하면 새 핸들러가 메시지를 수신한다', async () => {
            const received: string[] = []
            await fix.pubSubB.subscribe(subject, (msg) => received.push(msg))

            await fix.pubSubA.publish(subject, 'after-resubscribe')
            await waitFor(() => received.length > 0)

            expect(received).toEqual(['after-resubscribe'])
        })

        it('같은 핸들러를 다시 해제해도 오류 없이 끝난다', async () => {
            await expect(fix.pubSubB.unsubscribe(subject, handler)).resolves.toBeUndefined()
        })
    })

    describe('같은 subject에 핸들러 세 개가 차례로 등록되어 있으면', () => {
        let order: string[]
        beforeEach(async () => {
            order = []

            await fix.pubSubB.subscribe(subject, () => order.push('first'))
            await fix.pubSubB.subscribe(subject, () => order.push('second'))
            await fix.pubSubB.subscribe(subject, () => order.push('third'))
        })
        it('메시지를 발행하면 핸들러를 등록 순서대로 호출한다', async () => {
            await fix.pubSubA.publish(subject, 'msg')
            await waitFor(() => order.length === 3)

            expect(order).toEqual(['first', 'second', 'third'])
        })
    })

    it('구독 직후 발행한 메시지도 핸들러에 도달한다', async () => {
        const received: string[] = []

        await fix.pubSubB.subscribe(subject, (msg) => received.push(msg))
        // subscribe()가 flush까지 기다리므로 직후 발행한 메시지는 누락 없이 도달한다.
        await fix.pubSubA.publish(subject, 'immediate')

        await waitFor(() => received.length > 0)
        expect(received).toEqual(['immediate'])
    })
})

describe('createNatsPubSubServiceFixture', () => {
    let failure: Error
    let createContext: typeof testing.createTestContext
    let contexts: Array<{ close: () => Promise<void>; closeSpy: MockInstance }>

    beforeEach(() => {
        failure = new Error('fixture initialization failed')
        createContext = testing.createTestContext
        contexts = []
    })
    afterEach(() => waitForCleanup(contexts.map((context) => context.close())))

    describe('첫 번째 앱의 종료가 실패하고 두 번째 앱의 종료는 진행 중이면', () => {
        let fixture: NatsPubSubServiceFixture
        let firstError: Error
        let secondError: Error
        let finishSecond: PromiseWithResolvers<void>
        beforeEach(async () => {
            firstError = new Error('first app cleanup failed')
            secondError = new Error('second app cleanup failed')
            finishSecond = Promise.withResolvers<void>()
            vi.spyOn(testing, 'createTestContext').mockImplementation(async (options) => {
                const context = await createContext(options)
                const close = context.close.bind(context)
                contexts.push({ close, closeSpy: vi.spyOn(context, 'close') })
                return context
            })
            fixture = await createNatsPubSubServiceFixture()
            ensure(contexts[0]).closeSpy.mockRejectedValueOnce(firstError)
            ensure(contexts[1]).closeSpy.mockImplementationOnce(async () => {
                await finishSecond.promise
                throw secondError
            })
        })

        it('픽스처 종료는 두 번째 앱을 기다리고 두 종료 오류를 모두 전달한다', async () => {
            const cleanup = fixture.teardown()
            const rejected = vi.fn()
            const observed = cleanup.catch(rejected)
            try {
                // 첫 번째 거절의 반응까지 실행된 뒤에도 종료가 진행 중인지 확인한다.
                await nextTurn()
                expect(rejected).not.toHaveBeenCalled()
                expect(ensure(contexts[1]).closeSpy).toHaveBeenCalledTimes(1)
            } finally {
                finishSecond.resolve()
                await observed
            }
            await expect(cleanup).rejects.toBeInstanceOf(AggregateError)
            await expect(cleanup).rejects.toMatchObject({ errors: [firstError, secondError] })
        })
    })

    describe('두 번째 앱 생성이 실패하면', () => {
        beforeEach(() => {
            vi.spyOn(testing, 'createTestContext')
                .mockImplementationOnce(async (options) => {
                    const context = await createContext(options)
                    const close = context.close.bind(context)
                    const closeSpy = vi.spyOn(context, 'close')
                    contexts.push({ close, closeSpy })
                    return context
                })
                .mockRejectedValueOnce(failure)
        })

        it('먼저 만든 앱을 닫고 최초 초기화 오류를 던진다', async () => {
            await expect(createNatsPubSubServiceFixture()).rejects.toBe(failure)

            expect(contexts).toHaveLength(1)
            expect(ensure(contexts[0]).closeSpy).toHaveBeenCalledTimes(1)
        })
    })

    describe('연결 확인이 실패하면', () => {
        beforeEach(() => {
            vi.spyOn(testing, 'createTestContext')
                .mockImplementationOnce(async (options) => {
                    const context = await createContext(options)
                    const close = context.close.bind(context)
                    const closeSpy = vi.spyOn(context, 'close')
                    contexts.push({ close, closeSpy })

                    const connection = context.module.get<NatsConnection>(
                        getNatsConnectionToken('replicaA')
                    )
                    vi.spyOn(connection, 'flush').mockRejectedValueOnce(failure)
                    return context
                })
                .mockImplementationOnce(async (options) => {
                    const context = await createContext(options)
                    const close = context.close.bind(context)
                    const closeSpy = vi.spyOn(context, 'close')
                    contexts.push({ close, closeSpy })
                    return context
                })
        })

        it('두 앱을 모두 닫고 최초 초기화 오류를 던진다', async () => {
            await expect(createNatsPubSubServiceFixture()).rejects.toBe(failure)

            expect(contexts).toHaveLength(2)
            expect(ensure(contexts[0]).closeSpy).toHaveBeenCalledTimes(1)
            expect(ensure(contexts[1]).closeSpy).toHaveBeenCalledTimes(1)
        })
    })

    describe('연결 확인과 정리가 모두 실패하면', () => {
        beforeEach(() => {
            vi.spyOn(testing, 'createTestContext')
                .mockImplementationOnce(async (options) => {
                    const context = await createContext(options)
                    const close = context.close.bind(context)
                    const closeSpy = vi.spyOn(context, 'close').mockImplementation(async () => {
                        await close()
                        throw new Error('cleanup failed')
                    })
                    contexts.push({ close, closeSpy })

                    const connection = context.module.get<NatsConnection>(
                        getNatsConnectionToken('replicaA')
                    )
                    vi.spyOn(connection, 'flush').mockRejectedValueOnce(failure)
                    return context
                })
                .mockImplementationOnce(async (options) => {
                    const context = await createContext(options)
                    const close = context.close.bind(context)
                    const closeSpy = vi.spyOn(context, 'close')
                    contexts.push({ close, closeSpy })
                    return context
                })
        })

        it('두 앱의 정리를 시도하고 최초 초기화 오류를 던진다', async () => {
            await expect(createNatsPubSubServiceFixture()).rejects.toBe(failure)

            expect(contexts).toHaveLength(2)
            expect(ensure(contexts[0]).closeSpy).toHaveBeenCalledTimes(1)
            expect(ensure(contexts[1]).closeSpy).toHaveBeenCalledTimes(1)
        })
    })
})

describe('InjectNatsPubSub', () => {
    describe('기본 서비스와 이름이 지정된 서비스가 함께 등록되어 있으면', () => {
        @Injectable()
        class Subscriber {
            constructor(
                @InjectNatsPubSub() readonly defaultBus: NatsPubSubService,
                @InjectNatsPubSub('my-bus') readonly namedBus: NatsPubSubService
            ) {}
        }
        let context: Awaited<ReturnType<typeof testing.createTestContext>>
        beforeEach(async () => {
            context = await testing.createTestContext({
                imports: [
                    NatsModule.forRoot(JSON.parse(process.env.TESTLIB_NATS_OPTIONS!)),
                    NatsPubSubModule.register(),
                    NatsPubSubModule.register({ name: 'my-bus' })
                ],
                providers: [Subscriber]
            })
        })
        afterEach(() => context.close())
        it('구독자를 조회하면 각 주입 이름에 맞는 서비스를 받는다', () => {
            const subscriber = context.module.get(Subscriber)
            expect(subscriber.defaultBus).toBe(context.module.get(NatsPubSubService.getName()))
            expect(subscriber.namedBus).toBe(
                context.module.get(NatsPubSubService.getName('my-bus'))
            )
            expect(subscriber.defaultBus).not.toBe(subscriber.namedBus)
        })
    })
})

describe('NatsPubSubModule.register', () => {
    it('기본 옵션으로 동적 모듈을 생성한다', async () => {
        const dynamicModule = NatsPubSubModule.register()
        expect(dynamicModule.module).toBe(NatsPubSubModule)
        expect(dynamicModule.providers?.length).toBe(1)
        expect(dynamicModule.exports?.length).toBe(1)
    })
})

describe('JetStreamChannel', () => {
    let connection: NatsConnection
    let channel: JetStreamChannel
    let manager: Awaited<ReturnType<typeof jetstreamManager>>
    let streamName: string
    let messages: DurableMessages | undefined
    let iterator: AsyncIterator<DurableMessage> | undefined
    const consumerName = 'consumer'

    beforeEach(async () => {
        connection = await connect(JSON.parse(process.env.TESTLIB_NATS_OPTIONS!))
        manager = await jetstreamManager(connection)
        streamName = withTestId('durable').replaceAll(/[^a-zA-Z0-9_-]/g, '_')
        messages = undefined
        iterator = undefined
        channel = new JetStreamChannel(connection, {
            streamName,
            consumerName,
            subject: streamName + '.event',
            description: 'durable test',
            maxAgeMs: 60_000,
            duplicateWindowMs: 10_000,
            maxBytes: 1024 * 1024,
            ackWaitMs: 30_000
        })
    })
    afterEach(async () => {
        try {
            const ending = iterator?.next()
            await messages?.close()
            await ending
            await manager.streams.delete(streamName).catch((error: unknown) => {
                if (!(
                    error instanceof JetStreamApiError &&
                    error.code === JetStreamApiCodes.StreamNotFound
                )) {
                    throw error
                }
            })
        } finally {
            await connection.close()
        }
    })

    it('동시에 초기화한 뒤 같은 ID로 두 번 발행해도 메시지 한 건만 저장한다', async () => {
        await Promise.all([channel.initialize(), channel.initialize()])
        await channel.publish({ value: 'one' }, 'id')
        await channel.publish({ value: 'one' }, 'id')
        const info = await manager.streams.info(streamName)
        expect(info.state.messages).toBe(1)
        expect(info.config).toMatchObject({
            discard: 'new',
            retention: 'limits',
            storage: 'file',
            duplicate_window: 10_000_000_000,
            max_age: 60_000_000_000,
            max_bytes: 1024 * 1024
        })
    })

    describe('다른 스트림이 같은 subject를 사용하면', () => {
        let otherStream: string
        beforeEach(async () => {
            otherStream = streamName + '_other'
            await manager.streams.add({ name: otherStream, subjects: [streamName + '.event'] })
        })
        it('초기화에 실패한 뒤 충돌을 해소하면 같은 채널로 발행할 수 있다', async () => {
            try {
                await expect(channel.initialize()).rejects.toThrow(/overlap/i)
            } finally {
                await manager.streams.delete(otherStream)
            }
            await channel.publish({ value: 'recovered' }, 'id')
            expect((await manager.streams.info(streamName)).state.messages).toBe(1)
        })
    })

    describe('소비 시작 전에 발행한 메시지가 보관되어 있으면', () => {
        beforeEach(async () => {
            await channel.publish({ value: 'one' }, 'id')
        })
        it('소비를 시작해 메시지를 처리하고 ACK하면 서버의 확인 대기에서 제거한다', async () => {
            messages = await channel.consume()
            iterator = messages[Symbol.asyncIterator]()
            const result = await iterator.next()
            if (result.done) throw new Error('Expected a retained message')
            expect(result.value.decode()).toEqual({ value: 'one' })
            expect(result.value.deliveryCount).toBe(1)
            expect(result.value.sequence).toBe(1)
            const acknowledgments = connection.subscribe(
                `$JS.EVENT.METRIC.CONSUMER.ACK.${streamName}.${consumerName}`,
                { max: 1 }
            )
            await manager.consumers.update(streamName, consumerName, { sample_freq: '100' })
            result.value.acknowledge()
            // flush는 ACK 전송만 확인한다. 서버가 ACK를 처리했다는 이벤트 뒤에 상태를 읽는다.
            const acknowledgment = await acknowledgments[Symbol.asyncIterator]().next()
            expect(acknowledgment.value?.json()).toMatchObject({
                stream_seq: result.value.sequence
            })
            expect((await manager.consumers.info(streamName, consumerName)).num_ack_pending).toBe(0)
            const ending = iterator.next()
            await messages.close()
            expect(await ending).toEqual({ done: true, value: undefined })
        })
    })

    describe('소비자가 시작되었고 메시지가 발행되었으면', () => {
        beforeEach(async () => {
            messages = await channel.consume()
            await channel.publish({ value: 'retry' }, 'retry')
        })
        it('메시지 재시도를 요청하면 재전달하고 폐기하면 확인 대기에서 제거한다', async () => {
            iterator = ensure(messages)[Symbol.asyncIterator]()
            const first = await iterator.next()
            if (first.done) throw new Error('Expected the first delivery')
            const retryStarted = performance.now()
            first.value.retryAfter(100)
            const second = await iterator.next()
            if (second.done) throw new Error('Expected a redelivery')
            expect(performance.now() - retryStarted).toBeGreaterThanOrEqual(90)
            expect(second.value.sequence).toBe(first.value.sequence)
            expect(second.value.deliveryCount).toBe(2)
            const terminations = connection.subscribe(
                `$JS.EVENT.ADVISORY.CONSUMER.MSG_TERMINATED.${streamName}.${consumerName}`,
                { max: 1 }
            )
            await connection.flush()
            second.value.discard('invalid event')
            const termination = await terminations[Symbol.asyncIterator]().next()
            expect(termination.value?.json()).toMatchObject({
                stream_seq: second.value.sequence,
                reason: 'invalid event'
            })
            expect((await manager.consumers.info(streamName, consumerName)).num_ack_pending).toBe(0)
        })
    })
})
