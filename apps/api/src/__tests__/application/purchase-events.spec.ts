import { type NatsConnection, getNatsConnectionToken } from '@mannercode/common'
import {
    type ConsumerMessages,
    AckPolicy,
    DeliverPolicy,
    DiscardPolicy,
    ReplayPolicy,
    RetentionPolicy,
    StorageType,
    jetstream,
    jetstreamManager
} from '@nats-io/jetstream'
import type { MockInstance } from 'vitest'
import { PurchaseEvents } from '#application'
import { type AppTestContext, createAppTestContext } from '../helpers/index.js'
import { Logger } from '@nestjs/common'
import { waitFor } from './purchase-events.utils.js'
import { PurchaseNotificationService } from '../../services/application/purchase/internal/index.js'
import { NATS_CONNECTION_NAME } from '#config'

const NOTIFICATION_LOG = 'would send purchase confirmation'

const countLogCalls = (logSpy: MockInstance, message: string) =>
    logSpy.mock.calls.filter(([msg]) => msg === message).length

describe('PurchaseEvents', () => {
    let fix: AppTestContext
    let teardowns: AppTestContext['teardown'][]
    let events: PurchaseEvents
    let logSpy: MockInstance
    let errorSpy: MockInstance

    beforeEach(async () => {
        fix = await createAppTestContext()
        teardowns = [fix.teardown]
        events = fix.module.get(PurchaseEvents)

        logSpy = vi.spyOn(Logger.prototype, 'log')
        errorSpy = vi.spyOn(Logger.prototype, 'error')
    })

    afterEach(async () => Promise.all(teardowns.map((teardown) => teardown())))

    it('4개 복제본이 알림을 전체 한 번만 처리한다', async () => {
        const replicas = await Promise.all(Array.from({ length: 3 }, createAppTestContext))
        teardowns.push(...replicas.map((replica) => replica.teardown))

        await events.emitTicketPurchased({
            purchaseRecordId: 'purchase-replicas',
            ticketIds: ['t1', 't2'],
            userId: 'user-1'
        })

        await waitFor(() => countLogCalls(logSpy, NOTIFICATION_LOG) === 1)

        expect(logSpy).toHaveBeenCalledWith(
            NOTIFICATION_LOG,
            expect.objectContaining({
                dedupeKey: 'purchase-replicas',
                purchaseRecordId: 'purchase-replicas'
            })
        )
    })

    it('알림 소비자가 중단된 동안 발행한 이벤트를 재시작 뒤 처리한다', async () => {
        const notification = fix.module.get(PurchaseNotificationService)

        await notification.onModuleDestroy()
        await events.emitTicketPurchased({
            purchaseRecordId: 'purchase-offline',
            ticketIds: ['t1'],
            userId: 'user-1'
        })
        expect(countLogCalls(logSpy, NOTIFICATION_LOG)).toBe(0)

        await notification.onModuleInit()

        await waitFor(() => countLogCalls(logSpy, NOTIFICATION_LOG) === 1)
    })

    it('알림 처리 실패를 ack하지 않고 지연 재전달한다', async () => {
        let attempts = 0
        logSpy.mockImplementation((message) => {
            if (message === NOTIFICATION_LOG && attempts++ === 0) {
                throw new Error('temporary notification failure')
            }
        })

        await events.emitTicketPurchased({
            purchaseRecordId: 'purchase-retry',
            ticketIds: ['t1'],
            userId: 'user-1'
        })

        await waitFor(() => attempts === 2, 5000)
        expect(errorSpy).toHaveBeenCalledWith(
            'purchase notification retry scheduled',
            expect.objectContaining({ deliveryCount: 1, purchaseRecordId: 'purchase-retry' })
        )
    })

    it('같은 purchaseRecordId 재발행은 duplicate window에서 한 건만 저장한다', async () => {
        const { manager, streamName } = await getJetStream(fix, events)
        const event = {
            purchaseRecordId: 'purchase-duplicate',
            ticketIds: ['t1'],
            userId: 'user-1'
        }

        await events.emitTicketPurchased(event)
        await events.emitTicketPurchased(event)

        const stream = await manager.streams.info(streamName)
        expect(stream.state.messages).toBe(1)
    })

    it('구매 stream과 알림 durable consumer의 내구성 계약을 고정한다', async () => {
        const { manager, streamName } = await getJetStream(fix, events)
        const stream = await manager.streams.info(streamName)
        const consumers = await manager.consumers.list(streamName).next()
        const [consumer] = consumers

        expect(stream.config).toMatchObject({
            discard: DiscardPolicy.New,
            max_age: 7 * 24 * 60 * 60 * 1_000_000_000,
            max_bytes: 1024 * 1024,
            num_replicas: 1,
            retention: RetentionPolicy.Limits,
            storage: StorageType.File,
            subjects: [events.subjects.purchased]
        })
        expect(consumers).toHaveLength(1)
        expect(consumer?.config).toMatchObject({
            ack_policy: AckPolicy.Explicit,
            deliver_policy: DeliverPolicy.All,
            filter_subject: events.subjects.purchased,
            replay_policy: ReplayPolicy.Instant
        })
    })

    it('형식이 잘못된 이벤트는 재시도하지 않고 종료한다', async () => {
        const { connection, manager, streamName } = await getJetStream(fix, events)

        await jetstream(connection).publish(
            events.subjects.purchased,
            JSON.stringify({ purchaseRecordId: '', ticketIds: [], userId: 'user-1' }),
            { expect: { streamName }, msgID: 'invalid-purchase-event' }
        )

        await waitFor(() =>
            errorSpy.mock.calls.some(
                ([message]) => message === 'invalid purchase notification event'
            )
        )
        await waitFor(async () => {
            const [consumer] = await manager.consumers.list(streamName).next()
            return consumer?.num_ack_pending === 0 && consumer.num_pending === 0
        })
    })

    it('JSON이 아닌 이벤트도 재시도하지 않고 종료한다', async () => {
        const { connection, streamName } = await getJetStream(fix, events)

        await jetstream(connection).publish(events.subjects.purchased, 'not-json', {
            expect: { streamName },
            msgID: 'malformed-purchase-event'
        })

        await waitFor(() =>
            errorSpy.mock.calls.some(
                ([message]) => message === 'invalid purchase notification event'
            )
        )
    })
})

describe('PurchaseNotificationService', () => {
    it('소비 iterator가 조용히 끝나도 비정상 종료로 기록한다', async () => {
        const messages = fakeMessages(async function* () {})
        const { service, errorSpy } = await createNotificationService(messages)

        await service.onModuleInit()

        await waitFor(() =>
            errorSpy.mock.calls.some(
                ([message]) => message === 'purchase notification consumer stopped unexpectedly'
            )
        )
        await service.onModuleDestroy()

        expect(messages.close).toHaveBeenCalledOnce()
    })

    it('소비 iterator 오류를 기록하고 rejection을 외부로 누출하지 않는다', async () => {
        const failure = new Error('consumer failure')
        const messages = fakeMessages(async function* () {
            throw failure
        })
        const { service, errorSpy } = await createNotificationService(messages)

        await service.onModuleInit()

        await waitFor(() =>
            errorSpy.mock.calls.some(
                ([message]) => message === 'purchase notification consumer failed'
            )
        )
        await service.onModuleDestroy()

        expect(errorSpy).toHaveBeenCalledWith('purchase notification consumer failed', failure)
    })

    it('정상 종료 중 발생한 iterator 오류는 비정상 장애로 기록하지 않는다', async () => {
        let release!: () => void
        const gate = new Promise<void>((resolve) => (release = resolve))
        const messages = fakeMessages(async function* () {
            await gate
            throw new Error('closed iterator')
        }, release)
        const { service, errorSpy } = await createNotificationService(messages)

        await service.onModuleInit()
        await service.onModuleDestroy()

        expect(errorSpy).not.toHaveBeenCalledWith(
            'purchase notification consumer failed',
            expect.anything()
        )
    })

    it('초기화 전에 종료되어도 안전하다', async () => {
        const messages = fakeMessages(async function* () {})
        const { service } = await createNotificationService(messages)

        await expect(service.onModuleDestroy()).resolves.toBeUndefined()
        expect(messages.close).not.toHaveBeenCalled()
    })
})

async function getJetStream(fix: AppTestContext, events: PurchaseEvents) {
    const connection = fix.module.get<NatsConnection>(getNatsConnectionToken(NATS_CONNECTION_NAME))
    const manager = await jetstreamManager(connection)
    const streamName = await manager.streams.find(events.subjects.purchased)
    return { connection, manager, streamName }
}

function fakeMessages(
    iterator: () => AsyncGenerator<never, void, unknown>,
    onClose: () => void = () => undefined
) {
    const messages = iterator() as unknown as ConsumerMessages
    messages.close = vi.fn(async () => onClose())
    return messages
}

async function createNotificationService(messages: ConsumerMessages) {
    const fakeEvents = {
        consumeNotifications: vi.fn(async () => messages)
    } as unknown as PurchaseEvents
    return {
        errorSpy: vi.spyOn(Logger.prototype, 'error'),
        service: new PurchaseNotificationService(fakeEvents)
    }
}
