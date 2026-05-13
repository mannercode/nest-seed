import type { PurchaseEvents } from 'application'
import type { AppTestContext } from '../helpers'

const NOTIFICATION_LOG = 'would send purchase confirmation'
const PURCHASED_LOG = 'purchase observed'
const CANCELED_LOG = 'purchase canceled'

const countLogCalls = (logSpy: jest.SpyInstance, message: string) =>
    logSpy.mock.calls.filter(([msg]) => msg === message).length

describe('PurchaseEvents 구독자', () => {
    let fix: AppTestContext
    let events: PurchaseEvents
    let logSpy: jest.SpyInstance

    beforeEach(async () => {
        const { createAppTestContext } = await import('../helpers')
        const { PurchaseEvents } = await import('application')
        fix = await createAppTestContext()
        events = fix.module.get(PurchaseEvents)
        // `resetModules: true` 환경에서는 감시 대상 Logger가 구독자 Logger와
        // 같은 실행 영역에 있어야 합니다. 그래서 같은 모듈 그래프에서 동적으로 가져옵니다.
        const { Logger } = await import('@nestjs/common')
        logSpy = jest.spyOn(Logger.prototype, 'log')
    })

    afterEach(() => fix.teardown())

    it('ticketPurchased 이벤트는 알림 구독자와 로그 구독자 모두에 도달한다', async () => {
        const { waitFor } = await import('./purchase-events.utils')
        const userId = 'user-1'
        const ticketIds = ['t1', 't2']

        await events.emitTicketPurchased({ userId, ticketIds })

        await waitFor(
            () =>
                countLogCalls(logSpy, NOTIFICATION_LOG) > 0 &&
                countLogCalls(logSpy, PURCHASED_LOG) > 0
        )

        expect(countLogCalls(logSpy, NOTIFICATION_LOG)).toBe(1)
        expect(countLogCalls(logSpy, PURCHASED_LOG)).toBe(1)
    })

    it('ticketPurchaseCanceled 이벤트는 로그 구독자에만 도달한다', async () => {
        const { waitFor } = await import('./purchase-events.utils')
        const userId = 'user-2'
        const ticketIds = ['t3']

        await events.emitTicketPurchaseCanceled({ userId, ticketIds })

        await waitFor(() => countLogCalls(logSpy, CANCELED_LOG) > 0)

        // 알림 구독자는 대기 시간이 끝날 때까지 한 번도 호출되지 않아야 합니다.
        await new Promise((r) => setTimeout(r, 100))
        expect(countLogCalls(logSpy, CANCELED_LOG)).toBe(1)
        expect(countLogCalls(logSpy, NOTIFICATION_LOG)).toBe(0)
    })
})
