import { withTestId } from '@mannercode/testing'
import type { NatsPubSubServiceFixture } from './nats-pubsub.service.fixture'

// fixture 가 connection 을 flush 해 둬서 측정 윈도우엔 순수 메시지 round-trip
// 만 들어옴. NatsPubSubService.subscribe() 도 flush 후 리턴하므로 subscribe →
// publish 사이 race 도 없음. 500ms 가 터지면 진짜 latency 회귀 신호로 본다.
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

    // 두 replica 가 같은 NATS 를 공유할 때 한쪽 publish 가 다른 쪽 subscriber 에 도달한다
    it('delivers messages from one replica to another', async () => {
        const received: string[] = []
        await fix.pubSubB.subscribe(subject, (msg) => received.push(msg))

        await fix.pubSubA.publish(subject, 'hello')

        await waitFor(() => received.length > 0)
        expect(received).toEqual(['hello'])
    })

    // 한 subject 에 여러 subscriber 가 있을 때 모두 메시지를 받는다
    it('fans messages out to multiple handlers on the same subject', async () => {
        const received1: string[] = []
        const received2: string[] = []

        await fix.pubSubB.subscribe(subject, (msg) => received1.push(msg))
        await fix.pubSubB.subscribe(subject, (msg) => received2.push(msg))

        await fix.pubSubA.publish(subject, 'payload')

        await waitFor(() => received1.length > 0 && received2.length > 0)

        expect(received1).toEqual(['payload'])
        expect(received2).toEqual(['payload'])
    })

    // unsubscribe 후에는 해당 handler 에 메시지가 오지 않는다
    it('stops delivering to a handler after it unsubscribes', async () => {
        const received: string[] = []
        const handler = (msg: string) => received.push(msg)

        await fix.pubSubB.subscribe(subject, handler)

        await fix.pubSubA.publish(subject, 'before-unsub')
        await waitFor(() => received.length > 0)

        await fix.pubSubB.unsubscribe(subject, handler)

        await fix.pubSubA.publish(subject, 'after-unsub')
        // No reliable signal that "nothing arrived"; settle briefly then check.
        await new Promise((r) => setTimeout(r, 50))

        expect(received).toEqual(['before-unsub'])
    })

    // 구독한 적 없는 subject 에 대한 unsubscribe 는 no-op 이어야 한다
    it('no-ops unsubscribe on an unknown subject', async () => {
        await expect(fix.pubSubB.unsubscribe('never-subscribed', () => {})).resolves.toBeUndefined()
    })

    // 여러 handler 중 하나만 제거해도 NATS 구독은 유지된다
    it('keeps the NATS subscription alive while other handlers remain', async () => {
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

    // queue group 을 지정하면 같은 그룹 안에서 한 인스턴스만 메시지를 받는다
    it('routes a message to one queue-group member only', async () => {
        const receivedA: string[] = []
        const receivedB: string[] = []
        const queue = withTestId('queue-group')

        await fix.pubSubA.subscribe(subject, (msg) => receivedA.push(msg), { queue })
        await fix.pubSubB.subscribe(subject, (msg) => receivedB.push(msg), { queue })

        await fix.pubSubA.publish(subject, 'queued')
        await waitFor(() => receivedA.length + receivedB.length > 0)
        // Settle so a duplicate delivery (if any) would also have landed.
        await new Promise((r) => setTimeout(r, 50))

        expect(receivedA.length + receivedB.length).toBe(1)
    })

    // handler 한 개가 throw 해도 나머지 handler 로 전달이 막히지 않는다
    it('isolates handler errors so other handlers still receive', async () => {
        const received: string[] = []

        await fix.pubSubB.subscribe(subject, () => {
            throw new Error('boom')
        })
        await fix.pubSubB.subscribe(subject, (msg) => received.push(msg))

        await fix.pubSubA.publish(subject, 'after-throw')

        await waitFor(() => received.length > 0)
        expect(received).toEqual(['after-throw'])
    })
})

describe('InjectNatsPubSub', () => {
    // decorator factory 가 parameter decorator 를 반환한다 (기본 이름)
    it('returns a parameter decorator using the default name', async () => {
        const { InjectNatsPubSub } = await import('../nats-pubsub.service')
        expect(typeof InjectNatsPubSub()).toBe('function')
    })

    // decorator factory 가 parameter decorator 를 반환한다 (명명된 인스턴스)
    it('returns a parameter decorator for a named NatsPubSubService', async () => {
        const { InjectNatsPubSub } = await import('../nats-pubsub.service')
        expect(typeof InjectNatsPubSub('my-bus')).toBe('function')
    })
})

describe('NatsPubSubModule.register', () => {
    // 기본 옵션으로도 DynamicModule 을 만들 수 있다
    it('builds a module with defaults', async () => {
        const { NatsPubSubModule } = await import('../nats-pubsub.service')
        const dynamicModule = NatsPubSubModule.register()
        expect(dynamicModule.module).toBe(NatsPubSubModule)
        expect(dynamicModule.providers?.length).toBe(1)
        expect(dynamicModule.exports?.length).toBe(1)
    })
})
