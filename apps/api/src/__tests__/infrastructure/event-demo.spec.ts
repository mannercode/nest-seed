import { type DurableMessages, type DurableMessage } from '@mannercode/common'
import { Logger } from '@nestjs/common'
import { MessageConsumer } from '../../services/infrastructure/event-demo/internal/message-consumer.js'
import { HttpTestClient } from '@mannercode/testing'
import { EventDemoService } from '#infrastructure'
import { createAppTestContext, createAndLoginUser, type AppTestContext } from '../helpers/index.js'

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
    describe.each([
        { condition: '전달이 가능하면', failFirst: false },
        { condition: '첫 전달이 실패하면', failFirst: true }
    ])('$condition', ({ failFirst }) => {
        let received: ReturnType<typeof Promise.withResolvers<{ id: string; message: string }>>
        let messages: unknown[]
        beforeEach(async () => {
            const ready = Promise.withResolvers<void>()
            received = Promise.withResolvers<{ id: string; message: string }>()
            messages = []
            stream = new HttpTestClient(fix.httpClient.serverUrl)
                .get('/event-demo/event-stream')
                .headers({ Authorization: 'Bearer ' + session.accessToken })
                .sse(
                    (data) => {
                        const event = JSON.parse(data)
                        messages.push(event)
                        received.resolve(event)
                    },
                    received.reject,
                    ready.resolve
                )
            await ready.promise
            const events = fix.module.get(EventDemoService)
            await events.deliver({ id: 'other', message: 'not mine', userId: 'other-user' })
            if (failFirst)
                vi.spyOn(events, 'deliver').mockRejectedValueOnce(
                    new Error('NATS temporarily unavailable')
                )
        })
        it('메시지를 발행하면 JetStream 소비 후 본인의 SSE로 같은 메시지를 받는다', async () => {
            const { body } = await fix.httpClient
                .post('/event-demo/messages')
                .headers({ Authorization: 'Bearer ' + session.accessToken })
                .body({ message: 'hello event' })
                .accepted()
            const event = await received.promise
            expect(event).toEqual({ id: body.id, message: 'hello event' })
            expect(messages).toEqual([event])
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
            it('오류를 기록한다', async () => {
                await consumer.onModuleInit()
                expect(errors).toHaveBeenCalledWith('Message consumer stopped unexpectedly')
            })
        })
        describe('소비 도중 연결 오류가 발생하면', () => {
            const error = new Error('connection lost')
            beforeEach(() => {
                next.mockRejectedValue(error)
            })
            it('실패 원인을 기록한다', async () => {
                await consumer.onModuleInit()
                expect(errors).toHaveBeenCalledWith('Message consumer failed', error)
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
