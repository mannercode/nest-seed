import type { PurchaseEvents } from 'application'
import type { AppTestContext } from '../helpers'

const NOTIFICATION_LOG = 'would send purchase confirmation'
const PURCHASED_LOG = 'purchase observed'

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
        // `resetModules: true` 환경에서는 감시 대상 Logger가 구독자 Logger와 같은 실행 영역에 있어야 한다.
        // 그래서 같은 모듈 그래프에서 동적으로 가져온다.
        const { Logger } = await import('@nestjs/common')
        logSpy = jest.spyOn(Logger.prototype, 'log')
    })

    afterEach(() => fix.teardown())

    it('ticketPurchased 이벤트는 알림 구독자와 로그 구독자 모두에 전달한다', async () => {
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
})
