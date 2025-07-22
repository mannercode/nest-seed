import { PurchaseItemType, TicketStatus } from 'apps/cores'
import { pickIds } from 'common'
import { Errors } from '../__helpers__'
import { getPayments, getTickets } from '../common.fixture'
import { Fixture } from './purchases.fixture'

describe('PurchasesService', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./purchases.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('POST /purchases', () => {
        // payload가 유효한 경우
        describe('when the payload is valid', () => {
            // 구매를 생성하고 반환한다
            it('creates and returns the purchase', async () => {
                const purchaseItems = fix.heldTickets.map(({ id }) => ({
                    type: PurchaseItemType.Ticket,
                    ticketId: id
                }))

                const { body } = await fix.httpClient
                    .post('/purchases')
                    .body({ customerId: fix.customer.id, totalPrice: 1, purchaseItems })
                    .created()

                const purchase = body

                expect(purchase).toEqual({
                    id: expect.any(String),
                    createdAt: expect.any(Date),
                    updatedAt: expect.any(Date),
                    paymentId: expect.any(String),
                    customerId: fix.customer.id,
                    totalPrice: 1,
                    purchaseItems
                })

                // Creates a corresponding payment record
                // 연관된 결제 기록을 생성한다
                const payments = await getPayments(fix, [purchase.paymentId])
                expect(payments[0].amount).toEqual(purchase.totalPrice)

                // Changes the status of purchased tickets to "Sold"
                // 구매한 티켓의 상태를 "판매됨"으로 변경한다
                const soldTickets = await getTickets(fix, pickIds(fix.heldTickets))
                soldTickets.forEach((ticket) => expect(ticket.status).toBe(TicketStatus.Sold))

                // Leaves the status of unpurchased tickets unchanged
                // 구매하지 않은 티켓의 상태는 그대로 유지한다
                const remainingTickets = await getTickets(fix, pickIds(fix.availableTickets))
                remainingTickets.forEach((ticket) =>
                    expect(ticket.status).toBe(TicketStatus.Available)
                )
            })
        })

        // 최대 구매 수량을 초과한 경우
        describe('when the number of tickets exceeds the maximum', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                const { Rules } = await import('shared')
                Rules.Ticket.maxTicketsPerPurchase = fix.heldTickets.length - 1

                const purchaseItems = fix.heldTickets.map(({ id }) => ({
                    type: PurchaseItemType.Ticket,
                    ticketId: id
                }))

                await fix.httpClient
                    .post('/purchases')
                    .body({ customerId: fix.customer.id, totalPrice: 1, purchaseItems })
                    .badRequest({
                        ...Errors.TicketPurchase.MaxTicketsExceeded,
                        maxCount: expect.any(Number)
                    })
            })
        })

        // 구매 가능 시간이 지난 경우
        describe('when the purchase deadline has passed', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                const purchaseItems = [
                    { type: PurchaseItemType.Ticket, ticketId: fix.saleClosedTickets[0].id }
                ]

                await fix.httpClient
                    .post('/purchases')
                    .body({ customerId: fix.customer.id, totalPrice: 1, purchaseItems })
                    .badRequest({
                        ...Errors.TicketPurchase.DeadlineExceeded,
                        purchaseDeadlineInMinutes: expect.any(Number),
                        cutoffTime: expect.any(String),
                        startTime: expect.any(String)
                    })
            })
        })

        // 선점하지 않은 티켓을 구매하는 경우
        describe('when attempting to purchase tickets that have not been held', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                const purchaseItems = [
                    { type: PurchaseItemType.Ticket, ticketId: fix.availableTickets[0].id }
                ]

                await fix.httpClient
                    .post('/purchases')
                    .body({ customerId: fix.customer.id, totalPrice: 1, purchaseItems })
                    .badRequest(Errors.TicketPurchase.TicketNotHeld)
            })
        })

        // 구매 처리 중 내부 오류가 발생하는 경우
        describe('when an internal error occurs during purchase', () => {
            let spyRollback: jest.SpyInstance

            beforeEach(() => {
                jest.spyOn(fix.ticketsService, 'updateTicketStatus').mockImplementationOnce(() => {
                    throw new Error('purchase error')
                })
                spyRollback = jest.spyOn(fix.ticketPurchaseProcessor, 'rollbackPurchase')
            })

            // 구매 롤백을 실행한다
            it('triggers purchase rollback', async () => {
                const purchaseItems = fix.heldTickets.map(({ id }) => ({
                    type: PurchaseItemType.Ticket,
                    ticketId: id
                }))

                await fix.httpClient
                    .post('/purchases')
                    .body({ customerId: fix.customer.id, totalPrice: 1, purchaseItems })
                    .internalServerError()

                expect(spyRollback).toHaveBeenCalledTimes(1)
            })
        })
    })

    describe('GET /purchases/:purchaseId', () => {
        // 구매 정보가 존재하는 경우
        describe('when the purchase exists', () => {
            // 구매 정보를 반환한다.
            it('returns the purchase', async () => {
                await fix.httpClient.get(`/purchases/${fix.purchase.id}`).ok(fix.purchase)
            })
        })
    })
})
