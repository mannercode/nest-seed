import { PurchaseDto, PurchaseItemType, TicketStatus } from 'apps/cores'
import { pickIds } from 'common'
import { nullObjectId } from 'testlib'
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
        // 유효한 데이터가 제공된 경우
        describe('when provided valid data', () => {
            // 구매를 생성한다.
            it('creates a purchase', async () => {
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

                // creates a corresponding payment record
                // 연관된 결제 기록을 생성한다.
                const payments = await getPayments(fix, [purchase.paymentId])
                expect(payments[0].amount).toEqual(purchase.totalPrice)

                // updates the status of purchased tickets to "sold"
                // 구매된 티켓의 상태를 "판매됨"으로 변경한다.
                const soldTickets = await getTickets(fix, pickIds(fix.heldTickets))
                soldTickets.forEach((ticket) => expect(ticket.status).toBe(TicketStatus.Sold))

                // 구매되지 않은 티켓의 상태는 그대로 유지한다.
                // leaves other available tickets unchanged
                const remainingTickets = await getTickets(fix, pickIds(fix.availableTickets))
                remainingTickets.forEach((ticket) =>
                    expect(ticket.status).toBe(TicketStatus.Available)
                )
            })
        })

        // 최대 구매 가능 수량을 초과했을 때
        describe('when the number of tickets exceeds the maximum limit', () => {
            // BadRequest(400) 에러를 반환한다.
            it('returns a BadRequest(400) error', async () => {
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

        // 구매 가능 시간이 지났을 때
        describe('when the purchase deadline has passed', () => {
            // BadRequest(400) 에러를 반환한다.
            it('returns a BadRequest(400) error', async () => {
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

        // 선점하지 않은 티켓을 구매하려고 할 때
        describe('when attempting to purchase unheld tickets', () => {
            // BadRequest(400) 에러를 반환한다.
            it('returns a BadRequest(400) error', async () => {
                const purchaseItems = [
                    { type: PurchaseItemType.Ticket, ticketId: fix.availableTickets[0].id }
                ]

                await fix.httpClient
                    .post('/purchases')
                    .body({ customerId: fix.customer.id, totalPrice: 1, purchaseItems })
                    .badRequest(Errors.TicketPurchase.TicketNotHeld)
            })
        })

        // 구매 완료 처리 중 내부 오류가 발생했을 때
        describe('when an internal error occurs during the completion phase', () => {
            let spyRollback: jest.SpyInstance

            beforeEach(() => {
                jest.spyOn(fix.ticketsService, 'updateTicketStatus').mockImplementationOnce(() => {
                    throw new Error('purchase error')
                })
                spyRollback = jest.spyOn(fix.ticketPurchaseProcessor, 'rollbackPurchase')
            })

            // 500 Internal Server Error를 반환하고 구매 롤백 로직을 실행한다.
            it('returns a 500 Internal Server Error and triggers the purchase rollback logic', async () => {
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
        // 구매 내역이 존재할 때
        describe('when the purchase exists', () => {
            let purchase: PurchaseDto

            beforeEach(async () => {
                purchase = await fix.purchasesService.createPurchase({
                    customerId: fix.customer.id,
                    totalPrice: 1,
                    purchaseItems: [{ type: PurchaseItemType.Ticket, ticketId: nullObjectId }]
                })
            })

            // 구매 상세 정보를 반환한다.
            it('returns the purchase details', async () => {
                await fix.httpClient.get(`/purchases/${purchase.id}`).ok(purchase)
            })
        })
    })
})
