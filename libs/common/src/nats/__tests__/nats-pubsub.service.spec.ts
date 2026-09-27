import { connect, type NatsConnection } from '@nats-io/transport-node'
import { jetstreamManager } from '@nats-io/jetstream'
import type { MockInstance } from 'vitest'
import { withTestId } from '@mannercode/testing'
import * as testing from '@mannercode/testing'
import { ensure } from '../../utils/index.js'
import {
    type NatsPubSubServiceFixture,
    createNatsPubSubServiceFixture
} from './nats-pubsub.service.fixture.js'
import { Logger as NestLogger } from '@nestjs/common'
import {
    InjectNatsPubSub,
    getNatsConnectionToken,
    NatsPubSubModule,
    JetStreamChannel,
    type DurableMessages,
    type DurableMessage
} from '../index.js'

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

        it('한 핸들러를 해제해도 나머지 핸들러는 메시지를 수신한다', async () => {
            await fix.pubSubB.unsubscribe(subject, firstHandler)

            await fix.pubSubA.publish(subject, 'still-listening')
            await waitFor(() => received2.length > 0)
            expect(received2).toEqual(['still-listening'])
        })
    })

    describe('구독 등록의 flush 응답이 지연되면', () => {
        let flush: NatsConnection['flush']
        let ready: ReturnType<typeof Promise.withResolvers<void>>
        beforeEach(async () => {
            const connection = (fix.pubSubB as any).connection as NatsConnection
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

    describe('첫 구독의 flush가 실패하도록 설정하면', () => {
        let failure: Error
        beforeEach(() => {
            const connection = (fix.pubSubB as any).connection as NatsConnection
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
            // "아무 메시지도 오지 않음"을 보장할 신호가 없어 잠깐 대기 후 검사한다.
            // 부하 시 50ms는 부족하므로 200ms 여유를 둔다.
            await new Promise((r) => setTimeout(r, 200))

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
        it('공유 연결로 메시지를 발행해도 종료한 서비스의 핸들러는 호출되지 않는다', async () => {
            await fix.pubSubA.publish(subject, 'after-destroy')
            // "아무 메시지도 오지 않음"을 보장할 신호가 없어 잠깐 대기 후 검사한다.
            // 부하 시 50ms는 부족하므로 200ms 여유를 둔다.
            await new Promise((r) => setTimeout(r, 200))

            expect(received).toEqual([])
        })
    })

    describe.each([
        { label: '핸들러 두 개가 등록되어 있으면', unsubscribeFirst: false },
        { label: '핸들러 한 개가 등록되어 있으면', unsubscribeFirst: true }
    ])('$label', ({ unsubscribeFirst }) => {
        let entered: ReturnType<typeof Promise.withResolvers<void>>
        let release: ReturnType<typeof Promise.withResolvers<void>>
        let finished: ReturnType<typeof vi.fn<() => void>>
        let next: ReturnType<typeof vi.fn<() => void>>
        let handler: ReturnType<typeof vi.fn<() => Promise<void>>>
        beforeEach(async () => {
            entered = Promise.withResolvers<void>()
            release = Promise.withResolvers<void>()
            finished = vi.fn()
            next = vi.fn()
            handler = vi.fn(async () => {
                entered.resolve()
                await release.promise
                finished()
            })
            await fix.pubSubB.subscribe(subject, handler)
            if (!unsubscribeFirst) await fix.pubSubB.subscribe(subject, next)
        })
        it(
            unsubscribeFirst
                ? '처리 중인 핸들러의 구독을 해제하고 종료해도 그 처리가 끝날 때까지 기다린다'
                : '메시지 처리 중 종료하면 진행 중 핸들러를 기다리고 다음 핸들러는 호출하지 않는다',
            async () => {
                let stopping: Promise<void> | undefined
                let stopped = false

                try {
                    await fix.pubSubA.publish(subject, 'in-flight')
                    await entered.promise
                    await fix.pubSubA.publish(subject, 'queued')
                    if (unsubscribeFirst) await fix.pubSubB.unsubscribe(subject, handler)
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
                } finally {
                    release.resolve()
                    await stopping
                }
            }
        )
    })

    it('구독한 적 없는 subject를 해제해도 오류 없이 끝난다', async () => {
        await expect(fix.pubSubB.unsubscribe('never-subscribed', () => {})).resolves.toBeUndefined()
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
            // 중복 전달이 있었다면 도달했을 시간만큼 잠깐 기다린다.
            await new Promise((r) => setTimeout(r, 50))

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
            // 중복 전달이 있었다면 도달했을 시간만큼 잠깐 기다린다.
            await new Promise((r) => setTimeout(r, 50))

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

    describe('소비 루프의 이터레이터가 예외를 던지면', () => {
        let errorSpy: MockInstance
        let errorSubject: string

        // 이터레이터를 강제로 실패시킨다. 같은 실행 영역의 Logger를 감시한다.
        beforeEach(async () => {
            errorSpy = vi.spyOn(NestLogger.prototype, 'error').mockImplementation(() => undefined)

            errorSubject = withTestId('erroring')
            const fakeSub: any = {
                unsubscribe: vi.fn(),
                [Symbol.asyncIterator]: () => ({
                    next: () => Promise.reject(new Error('iterator boom')),
                    return: () => Promise.resolve({ done: true, value: undefined })
                })
            }

            vi.spyOn((fix.pubSubB as any).connection, 'subscribe').mockReturnValueOnce(fakeSub)

            await fix.pubSubB.subscribe(errorSubject, () => {})

            // 이터레이터가 한 번의 이벤트 루프 안에서 거부되고 catch 블록이 실행될 시간을 준다.
            await waitFor(() => errorSpy.mock.calls.length > 0)
        })

        it('수신 오류를 로그에 한 번 기록한다', () => {
            const errorCalls = errorSpy.mock.calls.filter((call) =>
                String(call[0]).includes(errorSubject)
            )
            expect(errorCalls).toHaveLength(1)
        })

        it('이후에 발행한 메시지는 더 이상 핸들러에 전달되지 않는다', async () => {
            const received: string[] = []

            // 셋업 이후 추가 핸들러를 등록해도 fakeSub에서는 메시지가 오지 않는다.
            const state = [...(fix.pubSubB as any).subscriptions.values()].find(
                (s: any) => s.subject === errorSubject
            )
            state?.handlers.add((msg: string) => received.push(msg))

            await fix.pubSubA.publish(errorSubject, 'after-throw')
            // 도달할 가능성을 충분히 줘도 비어 있어야 한다.
            await new Promise((r) => setTimeout(r, 100))

            expect(received).toEqual([])
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
    describe.each([
        { label: '두 번째 앱 생성이 실패하면', stage: 'second-context' },
        { label: '연결 확인이 실패하면', stage: 'flush' },
        { label: '연결 확인과 정리가 모두 실패하면', stage: 'cleanup' }
    ] as const)('$label', ({ stage }) => {
        let failure: Error
        let contexts: Array<{ close: () => Promise<void>; closeSpy: MockInstance }>
        beforeEach(async () => {
            failure = new Error('fixture initialization failed')
            const createContext = testing.createTestContext
            contexts = []
            vi.spyOn(testing, 'createTestContext').mockImplementation(async (options) => {
                if (stage === 'second-context' && contexts.length === 1) throw failure
                const context = await createContext(options)
                const close = context.close.bind(context)
                const first = contexts.length === 0
                const closeSpy = vi.spyOn(context, 'close').mockImplementation(async () => {
                    await close()
                    if (stage === 'cleanup' && first) throw new Error('cleanup failed')
                })
                contexts.push({ close, closeSpy })
                if (stage !== 'second-context' && first) {
                    const connection = context.module.get<NatsConnection>(
                        getNatsConnectionToken('replicaA')
                    )
                    vi.spyOn(connection, 'flush').mockRejectedValueOnce(failure)
                }
                return context
            })
        })
        it('픽스처 생성 시 이미 만든 앱을 모두 닫고 최초 초기화 오류를 던진다', async () => {
            try {
                await expect(createNatsPubSubServiceFixture()).rejects.toBe(failure)
                expect(contexts).toHaveLength(stage === 'second-context' ? 1 : 2)
                for (const context of contexts) expect(context.closeSpy).toHaveBeenCalledTimes(1)
            } finally {
                await Promise.allSettled(contexts.map((context) => context.close()))
            }
        })
    })
})

describe('InjectNatsPubSub', () => {
    it('이름 없이 호출하면 파라미터 데코레이터를 반환한다', async () => {
        expect(typeof InjectNatsPubSub(undefined)).toBe('function')
    })

    it('이름과 함께 호출해도 파라미터 데코레이터를 반환한다', async () => {
        expect(typeof InjectNatsPubSub('my-bus')).toBe('function')
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
        const ending = iterator?.next()
        await messages?.close()
        await ending
        await manager.streams.delete(streamName)
        await connection.close()
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
