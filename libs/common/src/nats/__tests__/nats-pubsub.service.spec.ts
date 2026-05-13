import { withTestId } from '@mannercode/testing'
import type { NatsPubSubServiceFixture } from './nats-pubsub.service.fixture'

/**
 * 픽스처가 연결을 flush해 두므로 측정 구간에는 순수 메시지 왕복만 들어옵니다.
 * NatsPubSubService.subscribe()도 flush 후 반환하므로 구독과 발행 사이의
 * 경합도 없습니다. 500ms 초과는 실제 지연 회귀 신호로 봅니다.
 */
async function waitFor(predicate: () => boolean, timeoutMs = 500) {
    const start = Date.now()
    while (!predicate()) {
        if (Date.now() - start > timeoutMs) {
            throw new Error(`waitFor timed out after ${timeoutMs}ms`)
        }
        await new Promise((r) => setTimeout(r, 10))
    }
}

describe('NatsPubSubService', () => {
    let fix: NatsPubSubServiceFixture
    let subject: string

    beforeEach(async () => {
        const { createNatsPubSubServiceFixture } = await import('./nats-pubsub.service.fixture')
        fix = await createNatsPubSubServiceFixture()
        subject = withTestId('nats-pubsub')
    })
    afterEach(() => fix.teardown())

    it('두 복제본이 같은 NATS를 공유하면 한쪽에서 발행한 메시지가 다른 쪽 구독자에게 도달한다', async () => {
        const received: string[] = []
        await fix.pubSubB.subscribe(subject, (msg) => received.push(msg))

        await fix.pubSubA.publish(subject, 'hello')

        await waitFor(() => received.length > 0)
        expect(received).toEqual(['hello'])
    })

    it('한 subject에 구독자가 여러 명 있으면 모두 메시지를 받는다', async () => {
        const received1: string[] = []
        const received2: string[] = []

        await fix.pubSubB.subscribe(subject, (msg) => received1.push(msg))
        await fix.pubSubB.subscribe(subject, (msg) => received2.push(msg))

        await fix.pubSubA.publish(subject, 'payload')

        await waitFor(() => received1.length > 0 && received2.length > 0)

        expect(received1).toEqual(['payload'])
        expect(received2).toEqual(['payload'])
    })

    it('구독 해제된 핸들러에는 더 이상 메시지가 오지 않는다', async () => {
        const received: string[] = []
        const handler = (msg: string) => received.push(msg)

        await fix.pubSubB.subscribe(subject, handler)

        await fix.pubSubA.publish(subject, 'before-unsub')
        await waitFor(() => received.length > 0)

        await fix.pubSubB.unsubscribe(subject, handler)

        await fix.pubSubA.publish(subject, 'after-unsub')
        // "아무 메시지도 오지 않음"을 보장할 신호가 없어 잠깐 대기 후 검사합니다.
        // 부하 시 50ms는 부족하므로 200ms 여유를 둡니다.
        await new Promise((r) => setTimeout(r, 200))

        expect(received).toEqual(['before-unsub'])
    })

    it('구독한 적 없는 subject를 구독 해제해도 아무 일도 일어나지 않는다', async () => {
        await expect(fix.pubSubB.unsubscribe('never-subscribed', () => {})).resolves.toBeUndefined()
    })

    it('여러 핸들러 중 하나만 제거해도 NATS 구독은 유지된다', async () => {
        const received: string[] = []
        const firstHandler = () => {}
        const secondHandler = (msg: string) => received.push(msg)

        await fix.pubSubB.subscribe(subject, firstHandler)
        await fix.pubSubB.subscribe(subject, secondHandler)

        await fix.pubSubB.unsubscribe(subject, firstHandler)

        await fix.pubSubA.publish(subject, 'still-listening')
        await waitFor(() => received.length > 0)
        expect(received).toEqual(['still-listening'])
    })

    it('큐 그룹을 지정하면 같은 그룹에서 인스턴스 하나만 메시지를 받는다', async () => {
        const receivedA: string[] = []
        const receivedB: string[] = []
        const queue = withTestId('queue-group')

        await fix.pubSubA.subscribe(subject, (msg) => receivedA.push(msg), { queue })
        await fix.pubSubB.subscribe(subject, (msg) => receivedB.push(msg), { queue })

        await fix.pubSubA.publish(subject, 'queued')
        await waitFor(() => receivedA.length + receivedB.length > 0)
        // 중복 전달이 있었다면 도달했을 시간만큼 잠깐 기다립니다.
        await new Promise((r) => setTimeout(r, 50))

        expect(receivedA.length + receivedB.length).toBe(1)
    })

    it('핸들러 하나가 예외를 던져도 나머지 핸들러에 전달이 막히지 않는다', async () => {
        const received: string[] = []

        await fix.pubSubB.subscribe(subject, () => {
            throw new Error('boom')
        })
        await fix.pubSubB.subscribe(subject, (msg) => received.push(msg))

        await fix.pubSubA.publish(subject, 'after-throw')

        await waitFor(() => received.length > 0)
        expect(received).toEqual(['after-throw'])
    })

    describe('소비 루프의 이터레이터가 예외를 던지면', () => {
        // 이터레이터를 강제로 실패시키는 도우미입니다. 같은 실행 영역의 Logger를 감시합니다.
        async function setupErroringSubscription() {
            const { Logger: NestLogger } = await import('@nestjs/common')
            const errorSpy = jest.spyOn(NestLogger.prototype, 'error').mockImplementation()

            const errorSubject = withTestId('erroring')
            const fakeError = new Error('iterator boom')
            const fakeSub: any = {
                unsubscribe: jest.fn(),
                [Symbol.asyncIterator]: () => ({
                    next: () => Promise.reject(fakeError),
                    return: () => Promise.resolve({ done: true, value: undefined })
                })
            }

            const subscribeSpy = jest
                .spyOn((fix.pubSubB as any).connection, 'subscribe')
                .mockReturnValueOnce(fakeSub)

            await fix.pubSubB.subscribe(errorSubject, () => {})

            // 이터레이터가 한 번의 이벤트 루프 안에서 거부되고 catch 블록이 실행될 시간을 줍니다.
            await waitFor(() => errorSpy.mock.calls.length > 0)

            return { errorSpy, errorSubject, fakeError, fakeSub, subscribeSpy }
        }

        it('logger.error를 한 번 호출하고 수신 루프를 조용히 종료한다', async () => {
            const { errorSpy, errorSubject } = await setupErroringSubscription()

            const errorCalls = errorSpy.mock.calls.filter((call) =>
                String(call[0]).includes(errorSubject)
            )
            expect(errorCalls).toHaveLength(1)
        })

        it('이후에 발행한 메시지는 더 이상 핸들러에 전달되지 않는다', async () => {
            const received: string[] = []
            const { errorSubject } = await setupErroringSubscription()

            // 위 설정 이후 추가 핸들러를 등록해도 fakeSub에서는 메시지가 오지 않습니다.
            const state = (fix.pubSubB as any).subscriptions.get(errorSubject)
            state?.handlers.add((msg: string) => received.push(msg))

            await fix.pubSubA.publish(errorSubject, 'after-throw')
            // 도달할 가능성을 충분히 줘도 비어 있어야 합니다.
            await new Promise((r) => setTimeout(r, 100))

            expect(received).toEqual([])
        })
    })

    it('subject의 모든 핸들러를 해제한 뒤 다시 구독하면 발행한 메시지가 정상 도달한다', async () => {
        const handler1 = () => {}
        await fix.pubSubB.subscribe(subject, handler1)
        await fix.pubSubB.unsubscribe(subject, handler1)

        const received: string[] = []
        await fix.pubSubB.subscribe(subject, (msg) => received.push(msg))

        await fix.pubSubA.publish(subject, 'after-resubscribe')
        await waitFor(() => received.length > 0)

        expect(received).toEqual(['after-resubscribe'])
    })

    it('이미 제거된 핸들러를 다시 구독 해제해도 예외를 던지지 않는다', async () => {
        const handler = () => {}
        await fix.pubSubB.subscribe(subject, handler)
        await fix.pubSubB.unsubscribe(subject, handler)

        await expect(fix.pubSubB.unsubscribe(subject, handler)).resolves.toBeUndefined()
    })

    it('같은 subject에 등록된 여러 핸들러는 등록 순서대로 호출된다', async () => {
        const order: string[] = []

        await fix.pubSubB.subscribe(subject, () => order.push('first'))
        await fix.pubSubB.subscribe(subject, () => order.push('second'))
        await fix.pubSubB.subscribe(subject, () => order.push('third'))

        await fix.pubSubA.publish(subject, 'msg')
        await waitFor(() => order.length === 3)

        expect(order).toEqual(['first', 'second', 'third'])
    })

    it('구독 직후 발행한 메시지도 핸들러에 도달한다', async () => {
        const received: string[] = []

        await fix.pubSubB.subscribe(subject, (msg) => received.push(msg))
        // subscribe()가 flush까지 기다리므로 직후 발행한 메시지는 누락 없이 도달합니다.
        await fix.pubSubA.publish(subject, 'immediate')

        await waitFor(() => received.length > 0)
        expect(received).toEqual(['immediate'])
    })
})

describe('InjectNatsPubSub', () => {
    it('이름 없이 호출하면 파라미터 데코레이터를 반환한다', async () => {
        const { InjectNatsPubSub } = await import('../nats-pubsub.service')
        expect(typeof InjectNatsPubSub(undefined)).toBe('function')
    })

    it('이름과 함께 호출해도 파라미터 데코레이터를 반환한다', async () => {
        const { InjectNatsPubSub } = await import('../nats-pubsub.service')
        expect(typeof InjectNatsPubSub('my-bus')).toBe('function')
    })
})

describe('NatsPubSubModule.register', () => {
    it('기본 옵션으로 동적 모듈을 생성한다', async () => {
        const { NatsPubSubModule } = await import('../nats-pubsub.service')
        const dynamicModule = NatsPubSubModule.register()
        expect(dynamicModule.module).toBe(NatsPubSubModule)
        expect(dynamicModule.providers?.length).toBe(1)
        expect(dynamicModule.exports?.length).toBe(1)
    })
})
