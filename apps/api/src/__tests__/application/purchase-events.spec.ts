import {
    AckPolicy,
    DeliverPolicy,
    DiscardPolicy,
    ReplayPolicy,
    RetentionPolicy,
    StorageType,
    jetstream
} from '@nats-io/jetstream'
import type { MockInstance } from 'vitest'
import { PurchaseEventService, type TicketPurchasedEvent } from '#application'
import { type AppTestContext, createAppTestContext } from '../helpers/index.js'
import { Logger } from '@nestjs/common'
import {
    getJetStream,
    getNotificationLogs,
    mockNotificationMessages,
    NOTIFICATION_LOG,
    waitFor,
    waitForNotifications
} from './purchase-events.utils.js'
import { PurchaseNotificationService } from '../../services/application/purchase/internal/index.js'

describe('PurchaseEventService', () => {
    let fix: AppTestContext
    let teardown: AppTestContext['teardown'] | undefined
    let events: PurchaseEventService

    beforeEach(async () => {
        teardown = undefined

        fix = await createAppTestContext()
        teardown = fix.teardown
        events = fix.module.get(PurchaseEventService)
    })
    afterEach(() => teardown?.())

    describe('emitTicketPurchased', () => {
        describe('같은 구매 ID의 이벤트를 이미 발행했을 때', () => {
            let event: TicketPurchasedEvent

            beforeEach(async () => {
                event = {
                    purchaseRecordId: 'purchase-duplicate',
                    ticketIds: ['t1'],
                    userId: 'user-1'
                }
                await events.emitTicketPurchased(event)
            })

            it('중복 발행 방지 기간 안에 다시 발행해도 한 건만 저장한다', async () => {
                await events.emitTicketPurchased(event)

                const { manager, streamName } = await getJetStream(fix)
                const stream = await manager.streams.info(streamName)
                expect(stream.state.messages).toBe(1)
            })
        })
    })

    describe('onModuleInit', () => {
        it('구매 이벤트의 보존 정책과 알림 소비자를 등록한다', async () => {
            const { manager, streamName } = await getJetStream(fix)
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
    })
})

describe('PurchaseNotificationService', () => {
    let fix: AppTestContext
    let teardowns: AppTestContext['teardown'][]
    let events: PurchaseEventService
    let notification: PurchaseNotificationService
    let logSpy: MockInstance
    let errorSpy: MockInstance

    beforeEach(async () => {
        teardowns = []

        fix = await createAppTestContext()
        teardowns.push(fix.teardown)
        events = fix.module.get(PurchaseEventService)
        notification = fix.module.get(PurchaseNotificationService)
        logSpy = vi.spyOn(Logger.prototype, 'log')
        errorSpy = vi.spyOn(Logger.prototype, 'error')
    })
    afterEach(async () => {
        const results = await Promise.allSettled(teardowns.map((teardown) => teardown()))
        const failure = results.find((result) => result.status === 'rejected')
        if (failure) throw failure.reason
    })

    describe('구매 완료 알림', () => {
        describe('여러 앱이 같은 소비자를 공유할 때', () => {
            beforeEach(async () => {
                // 한 프로세스의 앱 4개다. 프로세스 장애·재전달의 중복 방지 검증은 아니다.
                for (let i = 0; i < 3; i++) {
                    const context = await createAppTestContext()
                    teardowns.push(context.teardown)
                }
            })

            it('구매 이벤트 한 건을 한 번 처리한다', async () => {
                await events.emitTicketPurchased({
                    purchaseRecordId: 'purchase-replicas',
                    ticketIds: ['t1', 't2'],
                    userId: 'user-1'
                })
                await waitForNotifications(fix)

                expect(getNotificationLogs(logSpy)).toEqual([
                    [
                        NOTIFICATION_LOG,
                        {
                            dedupeKey: 'purchase-replicas',
                            purchaseRecordId: 'purchase-replicas',
                            ticketCount: 2,
                            userId: 'user-1'
                        }
                    ]
                ])
            })
        })

        describe('소비자가 중단된 동안 이벤트가 발행되었을 때', () => {
            beforeEach(async () => {
                await notification.onModuleDestroy()
                await events.emitTicketPurchased({
                    purchaseRecordId: 'purchase-offline',
                    ticketIds: ['t1'],
                    userId: 'user-1'
                })
            })

            it('소비자를 다시 시작하면 보관된 이벤트를 처리한다', async () => {
                expect(getNotificationLogs(logSpy)).toHaveLength(0)

                await notification.onModuleInit()
                await waitForNotifications(fix)

                expect(getNotificationLogs(logSpy)).toHaveLength(1)
                expect(logSpy).toHaveBeenCalledWith(
                    NOTIFICATION_LOG,
                    expect.objectContaining({ purchaseRecordId: 'purchase-offline' })
                )
            })
        })

        describe('첫 알림 처리에 실패할 때', () => {
            let attempts: number

            beforeEach(() => {
                attempts = 0
                logSpy.mockImplementation((message) => {
                    if (message === NOTIFICATION_LOG && attempts++ === 0) {
                        throw new Error('temporary notification failure')
                    }
                })
            })

            it('이벤트를 재전달받아 알림을 처리한다', async () => {
                await events.emitTicketPurchased({
                    purchaseRecordId: 'purchase-retry',
                    ticketIds: ['t1'],
                    userId: 'user-1'
                })
                await waitForNotifications(fix, 5000)

                expect(attempts).toBe(2)
                expect(errorSpy).toHaveBeenCalledWith(
                    'purchase notification retry scheduled',
                    expect.objectContaining({
                        deliveryCount: 1,
                        purchaseRecordId: 'purchase-retry'
                    })
                )
            })
        })

        describe.each([
            [
                '필수 필드가 잘못된',
                JSON.stringify({ purchaseRecordId: '', ticketIds: [], userId: 'user-1' })
            ],
            ['JSON이 아닌', 'not-json']
        ])('%s 이벤트를 받았을 때', (_, payload) => {
            let stream: Awaited<ReturnType<typeof getJetStream>>

            beforeEach(async () => {
                stream = await getJetStream(fix)
            })

            it('오류를 기록하고 소비 대기 목록에서 제거한다', async () => {
                const { connection, streamName } = stream
                await jetstream(connection).publish(events.subjects.purchased, payload, {
                    expect: { streamName },
                    msgID: 'invalid-purchase-event'
                })
                await waitForNotifications(fix)

                expect(getNotificationLogs(logSpy)).toHaveLength(0)
                expect(errorSpy).toHaveBeenCalledWith(
                    'invalid purchase notification event',
                    expect.objectContaining({ error: expect.anything(), streamSequence: 1 })
                )
            })
        })
    })

    describe('onModuleInit', () => {
        beforeEach(() => notification.onModuleDestroy())

        describe('소비 스트림이 오류 없이 끝날 때', () => {
            let messages: ReturnType<typeof mockNotificationMessages>

            beforeEach(() => {
                messages = mockNotificationMessages(fix, async function* () {})
            })

            it('예기치 않은 종료를 기록하고 스트림을 정리한다', async () => {
                await notification.onModuleInit()
                await waitFor(() => errorSpy.mock.calls.length > 0)
                await notification.onModuleDestroy()

                expect(errorSpy).toHaveBeenCalledWith(
                    'purchase notification consumer stopped unexpectedly'
                )
                expect(messages.close).toHaveBeenCalledOnce()
            })
        })

        describe('소비 스트림이 예외를 던질 때', () => {
            let failure: Error

            beforeEach(() => {
                failure = new Error('consumer failure')
                mockNotificationMessages(fix, async function* () {
                    throw failure
                })
            })

            it('원인을 기록하고 종료 시 오류를 다시 던지지 않는다', async () => {
                await notification.onModuleInit()
                await waitFor(() => errorSpy.mock.calls.length > 0)

                expect(errorSpy).toHaveBeenCalledWith(
                    'purchase notification consumer failed',
                    failure
                )
                await expect(notification.onModuleDestroy()).resolves.toBeUndefined()
            })
        })
    })

    describe('onModuleDestroy', () => {
        beforeEach(() => notification.onModuleDestroy())

        describe('스트림을 닫을 때 예외가 발생하는 경우', () => {
            let messages: ReturnType<typeof mockNotificationMessages>

            beforeEach(async () => {
                const release = Promise.withResolvers<void>()
                messages = mockNotificationMessages(
                    fix,
                    async function* () {
                        await release.promise
                        throw new Error('closed iterator')
                    },
                    release.resolve
                )
                await notification.onModuleInit()
            })

            it('종료 중인 스트림의 오류를 장애로 기록하지 않는다', async () => {
                await notification.onModuleDestroy()

                expect(messages.close).toHaveBeenCalledOnce()
                expect(errorSpy).not.toHaveBeenCalled()
            })
        })

        describe('서비스가 아직 초기화되지 않았을 때', () => {
            let uninitialized: PurchaseNotificationService
            let consume: MockInstance

            beforeEach(() => {
                uninitialized = new PurchaseNotificationService(events)
                consume = vi.spyOn(events, 'consumeNotifications')
            })

            it('소비를 시작하지 않고 종료한다', async () => {
                await expect(uninitialized.onModuleDestroy()).resolves.toBeUndefined()

                expect(consume).not.toHaveBeenCalled()
            })
        })
    })
})
