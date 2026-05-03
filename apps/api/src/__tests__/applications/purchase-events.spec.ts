import type { PurchaseEventsFixture } from './purchase-events.fixture'

describe('PurchaseEvents subscribers', () => {
    let fix: PurchaseEventsFixture

    beforeEach(async () => {
        const { createPurchaseEventsFixture } = await import('./purchase-events.fixture')
        fix = await createPurchaseEventsFixture()
    })

    afterEach(() => fix.teardown())

    // ticketPurchased 는 queue-group 핸들러(notification) 와 broadcast 핸들러(logger) 양쪽으로 도달한다
    it('delivers ticketPurchased to both notification and logger', async () => {
        const { waitFor } = await import('./purchase-events.fixture')
        const userId = 'user-1'
        const ticketIds = ['t1', 't2']

        await fix.events.emitTicketPurchased({ userId, ticketIds })

        await waitFor(
            () =>
                fix.notification.received.length > 0 &&
                fix.logger.entries.some((e) => e.kind === 'purchased')
        )

        expect(fix.notification.received).toEqual([{ userId, ticketIds }])
        const purchased = fix.logger.entries.filter((e) => e.kind === 'purchased')
        expect(purchased).toEqual([{ event: { userId, ticketIds }, kind: 'purchased' }])
    })

    // ticketPurchaseCanceled 는 logger 만 구독함 — notification 은 받지 않는다
    it('delivers ticketPurchaseCanceled only to the logger', async () => {
        const { waitFor } = await import('./purchase-events.fixture')
        const userId = 'user-2'
        const ticketIds = ['t3']

        await fix.events.emitTicketPurchaseCanceled({ userId, ticketIds })

        await waitFor(() => fix.logger.entries.some((e) => e.kind === 'canceled'))

        // notification 측은 timed window 안에서 끝까지 비어 있어야 한다
        await new Promise((r) => setTimeout(r, 100))
        expect(fix.notification.received).toEqual([])
        expect(fix.logger.entries).toEqual([{ event: { userId, ticketIds }, kind: 'canceled' }])
    })
})
