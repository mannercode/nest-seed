import type { PurchaseEventsFixture } from './purchase-events.fixture'

const NOTIFICATION_LOG = 'would send purchase confirmation'
const PURCHASED_LOG = 'purchase observed'
const CANCELED_LOG = 'purchase canceled'

const countLogCalls = (logSpy: jest.SpyInstance, message: string) =>
    logSpy.mock.calls.filter(([msg]) => msg === message).length

describe('PurchaseEvents subscribers', () => {
    let fix: PurchaseEventsFixture
    let logSpy: jest.SpyInstance

    beforeEach(async () => {
        const { createPurchaseEventsFixture } = await import('./purchase-events.fixture')
        fix = await createPurchaseEventsFixture()
        // resetModules:true 환경에서 subscriber 가 사용하는 Logger 와 같은 realm 의
        // 클래스를 잡기 위해 dynamic import 로 가져온다.
        const { Logger } = await import('@nestjs/common')
        logSpy = jest.spyOn(Logger.prototype, 'log')
    })

    afterEach(() => fix.teardown())

    it('ticketPurchased 이벤트는 notification(queue-group)과 logger(broadcast) 양쪽에 도달한다', async () => {
        const { waitFor } = await import('./purchase-events.fixture')
        const userId = 'user-1'
        const ticketIds = ['t1', 't2']

        await fix.events.emitTicketPurchased({ userId, ticketIds })

        await waitFor(
            () =>
                countLogCalls(logSpy, NOTIFICATION_LOG) > 0 &&
                countLogCalls(logSpy, PURCHASED_LOG) > 0
        )

        expect(countLogCalls(logSpy, NOTIFICATION_LOG)).toBe(1)
        expect(countLogCalls(logSpy, PURCHASED_LOG)).toBe(1)
    })

    it('ticketPurchaseCanceled 이벤트는 logger에만 도달하고 notification에는 도달하지 않는다', async () => {
        const { waitFor } = await import('./purchase-events.fixture')
        const userId = 'user-2'
        const ticketIds = ['t3']

        await fix.events.emitTicketPurchaseCanceled({ userId, ticketIds })

        await waitFor(() => countLogCalls(logSpy, CANCELED_LOG) > 0)

        // notification 측은 대기 구간 끝까지 비어 있어야 한다.
        await new Promise((r) => setTimeout(r, 100))
        expect(countLogCalls(logSpy, CANCELED_LOG)).toBe(1)
        expect(countLogCalls(logSpy, NOTIFICATION_LOG)).toBe(0)
    })
})
