import { withTestId } from '@mannercode/testing'
import type { NatsPubSubServiceFixture } from './nats-pubsub.service.fixture'

// fixture가 연결을 flush해 두므로 측정 구간에는 순수 메시지 왕복만 들어온다.
// NatsPubSubService.subscribe()도 flush 후 리턴하므로 subscribe→publish 간 경합도 없다.
// 500ms 초과는 진짜 지연 회귀 신호로 본다.
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

    it('두 replica가 같은 NATS를 공유하면 한쪽의 publish가 다른 쪽 subscriber에 도달한다', async () => {
        const received: string[] = []
        await fix.pubSubB.subscribe(subject, (msg) => received.push(msg))

        await fix.pubSubA.publish(subject, 'hello')

        await waitFor(() => received.length > 0)
        expect(received).toEqual(['hello'])
    })

    it('한 subject에 여러 subscriber가 있으면 모두 메시지를 받는다', async () => {
        const received1: string[] = []
        const received2: string[] = []

        await fix.pubSubB.subscribe(subject, (msg) => received1.push(msg))
        await fix.pubSubB.subscribe(subject, (msg) => received2.push(msg))

        await fix.pubSubA.publish(subject, 'payload')

        await waitFor(() => received1.length > 0 && received2.length > 0)

        expect(received1).toEqual(['payload'])
        expect(received2).toEqual(['payload'])
    })

    it('unsubscribe된 handler에는 더 이상 메시지가 오지 않는다', async () => {
        const received: string[] = []
        const handler = (msg: string) => received.push(msg)

        await fix.pubSubB.subscribe(subject, handler)

        await fix.pubSubA.publish(subject, 'before-unsub')
        await waitFor(() => received.length > 0)

        await fix.pubSubB.unsubscribe(subject, handler)

        await fix.pubSubA.publish(subject, 'after-unsub')
        // "아무 메시지도 오지 않음"을 보장할 신호가 없어 잠깐 대기 후 검사한다.
        // 부하 시 50ms는 부족하므로 200ms 여유를 둔다.
        await new Promise((r) => setTimeout(r, 200))

        expect(received).toEqual(['before-unsub'])
    })

    it('구독한 적 없는 subject에 unsubscribe해도 아무 일도 일어나지 않는다', async () => {
        await expect(fix.pubSubB.unsubscribe('never-subscribed', () => {})).resolves.toBeUndefined()
    })

    it('여러 handler 중 하나만 제거해도 NATS 구독은 유지된다', async () => {
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

    it('queue 그룹을 지정하면 같은 그룹에서 인스턴스 하나만 메시지를 받는다', async () => {
        const receivedA: string[] = []
        const receivedB: string[] = []
        const queue = withTestId('queue-group')

        await fix.pubSubA.subscribe(subject, (msg) => receivedA.push(msg), { queue })
        await fix.pubSubB.subscribe(subject, (msg) => receivedB.push(msg), { queue })

        await fix.pubSubA.publish(subject, 'queued')
        await waitFor(() => receivedA.length + receivedB.length > 0)
        // 중복 전달이 있었다면 도달했을 시간만큼 잠깐 대기.
        await new Promise((r) => setTimeout(r, 50))

        expect(receivedA.length + receivedB.length).toBe(1)
    })

    it('handler 하나가 예외를 던져도 나머지 handler에 전달이 막히지 않는다', async () => {
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
        it.todo('logger.error를 한 번 호출하고 루프를 조용히 종료한다')
        it.todo('이후의 publish는 더 이상 handler에 전달되지 않는다')
        it.todo('끊긴 subject에 다시 구독하면 메시지가 정상 도달한다')
    })

    it.todo('subject의 모든 handler를 해제한 뒤 다시 구독하면 publish가 정상 도달한다')
    it.todo('이미 제거된 handler를 다시 unsubscribe해도 예외를 던지지 않는다')
    it.todo('같은 subject에 등록된 여러 handler는 등록 순서대로 호출된다')
    it.todo('subscribe 직후 publish한 메시지도 handler에 도달한다')
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
    it('기본 옵션으로 DynamicModule을 생성한다', async () => {
        const { NatsPubSubModule } = await import('../nats-pubsub.service')
        const dynamicModule = NatsPubSubModule.register()
        expect(dynamicModule.module).toBe(NatsPubSubModule)
        expect(dynamicModule.providers?.length).toBe(1)
        expect(dynamicModule.exports?.length).toBe(1)
    })
})
