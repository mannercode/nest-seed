import { JetStreamChannel, type DurableMessages, type DurableMessage } from '@mannercode/common'
import { Logger } from '@nestjs/common'
import { HttpTestClient } from '@mannercode/testing'
import { EventDemoService, eventDemoResources, MessageConsumer } from '#infrastructure'
import {
    createAppTestContext,
    createAndLoginUser,
    ownsEventStream,
    projectId,
    type AppTestContext
} from '../helpers/index.js'

describe('JetStream 테스트 자원 정리', () => {
    const event = eventDemoResources(projectId('worker-1'))
    const appEvent = eventDemoResources('app')
    describe.each([
        {
            condition: '테스트 스트림과 단일 subject가 일치하면',
            name: event.streamName,
            subjects: [event.subjects.queued],
            owned: true
        },
        {
            condition: '다른 스트림이 테스트 subject를 사용하면',
            name: 'other',
            subjects: [event.subjects.queued],
            owned: false
        },
        {
            condition: '다른 subject도 함께 사용하면',
            name: event.streamName,
            subjects: [event.subjects.queued, 'other'],
            owned: false
        },
        {
            condition: '앱이 생성한 스트림이면',
            name: appEvent.streamName,
            subjects: [appEvent.subjects.queued],
            owned: false
        }
    ])('$condition', ({ name, subjects, owned }) => {
        it(`스트림을 검사하면 정리 대상 여부로 ${owned}를 반환한다`, () => {
            expect(ownsEventStream({ name, subjects })).toBe(owned)
        })
    })
})

describe('EventDemoService', () => {
    let fix: AppTestContext
    let session: Awaited<ReturnType<typeof createAndLoginUser>>
    let stream: HttpTestClient | undefined
    beforeEach(async () => {
        fix = await createAppTestContext()
        session = await createAndLoginUser(fix)
    })
    afterEach(async () => {
        stream?.abort()
        stream = undefined
        await fix?.teardown()
    })
    it('인증 없이 메시지를 발행하면 401을 반환한다', async () => {
        await fix.httpClient.post('/event-demo/messages').body({ message: 'hello' }).unauthorized()
    })
    describe('메시지가 비어 있으면', () => {
        it('발행을 요청하면 400을 반환한다', async () => {
            await fix.httpClient
                .post('/event-demo/messages')
                .headers({ Authorization: 'Bearer ' + session.accessToken })
                .body({ message: '' })
                .badRequest()
        })
    })
    describe('JetStream이 메시지 접수를 거절하면', () => {
        beforeEach(() => {
            vi.spyOn(JetStreamChannel.prototype, 'publish').mockRejectedValueOnce(
                new Error('publish rejected')
            )
        })
        it('메시지를 발행하면 500을 반환한다', async () => {
            await fix.httpClient
                .post('/event-demo/messages')
                .headers({ Authorization: 'Bearer ' + session.accessToken })
                .body({ message: 'hello' })
                .internalServerError()
        })
    })
    describe.each([
        { condition: '전달이 가능하면', failFirst: false },
        { condition: '첫 전달이 실패하면', failFirst: true }
    ])('$condition', ({ failFirst }) => {
        let waitForDelivery: () => Promise<void>
        let messages: string[]
        beforeEach(async () => {
            const ready = Promise.withResolvers<void>()
            const received = Promise.withResolvers<void>()
            const failed = Promise.withResolvers<never>()
            messages = []
            stream = new HttpTestClient(fix.httpClient.serverUrl)
                .get('/event-demo/event-stream')
                .headers({ Authorization: 'Bearer ' + session.accessToken })
                .sse(
                    (data) => {
                        messages.push(data)
                        received.resolve()
                    },
                    failed.reject,
                    ready.resolve
                )
            await Promise.race([ready.promise, failed.promise])
            const events = fix.module.get(EventDemoService)
            await events.deliver({ id: 'other', message: 'not mine', userId: 'other-user' })
            if (failFirst)
                vi.spyOn(events, 'deliver').mockRejectedValueOnce(
                    new Error('NATS temporarily unavailable')
                )
            waitForDelivery = () => Promise.race([received.promise, failed.promise])
        })
        it('메시지를 발행하면 202와 이벤트 ID를 반환하고 본인의 SSE에서 같은 ID와 메시지를 받는다', async () => {
            const [, { body }] = await Promise.all([
                waitForDelivery(),
                fix.httpClient
                    .post('/event-demo/messages')
                    .headers({ Authorization: 'Bearer ' + session.accessToken })
                    .body({ message: 'hello event' })
                    .accepted()
            ])
            expect(body).toEqual({ id: expect.stringMatching(/\S/) })
            for (const data of messages) {
                expect(JSON.parse(data)).toEqual({ id: body.id, message: 'hello event' })
            }
        })
    })
    describe('메시지 소비자의 입력과 종료', () => {
        let consumer: MessageConsumer
        let next: ReturnType<typeof vi.fn<() => Promise<IteratorResult<DurableMessage>>>>
        let messages: DurableMessages
        const spyErrors = () => vi.spyOn(Logger.prototype, 'error')
        let errors: ReturnType<typeof spyErrors>
        beforeEach(() => {
            const service = fix.module.get(EventDemoService)
            next = vi.fn()
            messages = {
                [Symbol.asyncIterator]: () => ({ next }),
                close: vi.fn(async () => undefined)
            }
            vi.spyOn(service, 'consume').mockResolvedValue(messages)
            errors = spyErrors().mockImplementation(() => undefined)
            consumer = new MessageConsumer(service)
        })
        afterEach(() => consumer.onModuleDestroy())
        describe('소비가 예기치 않게 끝나면', () => {
            beforeEach(() => {
                next.mockResolvedValue({ done: true, value: undefined })
            })
            it('소비 중단 상태와 원인을 남긴다', async () => {
                await consumer.onModuleInit()
                expect(errors).toHaveBeenCalledWith('Message consumer stopped unexpectedly')
                expect(consumer.isRunning).toBe(false)
            })
        })
        describe('소비 도중 연결 오류가 발생하면', () => {
            const error = new Error('connection lost')
            beforeEach(() => {
                next.mockRejectedValue(error)
            })
            it('소비 중단 상태와 실패 원인을 남긴다', async () => {
                await consumer.onModuleInit()
                expect(errors).toHaveBeenCalledWith('Message consumer failed', error)
                expect(consumer.isRunning).toBe(false)
            })
        })
        describe('종료 중에 대기하던 읽기가 거절되면', () => {
            beforeEach(() => {
                const pending = Promise.withResolvers<IteratorResult<DurableMessage>>()
                next.mockReturnValue(pending.promise)
                messages.close = async () => {
                    pending.reject(new Error('closed'))
                }
            })
            it('소비 작업을 끝내고 종료 오류로 기록하지 않는다', async () => {
                await consumer.onModuleInit()
                await consumer.onModuleDestroy()
                expect(errors).not.toHaveBeenCalled()
            })
        })
        describe('소비 시작 자체가 실패하면', () => {
            beforeEach(() => {
                vi.spyOn(fix.module.get(EventDemoService), 'consume').mockRejectedValue(
                    new Error('cannot consume')
                )
            })
            it('초기화 오류를 전달하고 부분 초기화 상태도 정리할 수 있다', async () => {
                await expect(consumer.onModuleInit()).rejects.toThrow('cannot consume')
                await expect(consumer.onModuleDestroy()).resolves.toBeUndefined()
            })
        })
        describe('스키마가 잘못된 메시지를 받으면', () => {
            let invalid: DurableMessage
            let discarded: ReturnType<typeof Promise.withResolvers<void>>
            beforeEach(() => {
                discarded = Promise.withResolvers<void>()
                const end = Promise.withResolvers<IteratorResult<DurableMessage>>()
                invalid = {
                    decode: () => ({ message: 1 }),
                    acknowledge: vi.fn(),
                    retryAfter: vi.fn(),
                    discard: vi.fn(() => discarded.resolve()),
                    deliveryCount: 1,
                    sequence: 1
                }
                next.mockResolvedValueOnce({ done: false, value: invalid }).mockReturnValue(
                    end.promise
                )
                messages.close = async () => {
                    end.resolve({ done: true, value: undefined })
                }
            })
            it('메시지를 폐기하며 처리 완료나 재시도로 표시하지 않는다', async () => {
                await consumer.onModuleInit()
                await discarded.promise
                expect(invalid.discard).toHaveBeenCalledWith('Invalid demo message')
                expect(invalid.acknowledge).not.toHaveBeenCalled()
                expect(invalid.retryAfter).not.toHaveBeenCalled()
                expect(errors).toHaveBeenCalledWith('Invalid demo message', expect.any(Error))
            })
        })
    })
})
