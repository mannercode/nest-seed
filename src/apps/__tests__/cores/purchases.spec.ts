import { PurchaseDto, PurchaseItemDto, PurchaseItemType, TicketDto, TicketStatus } from 'apps/cores'
import { Rules } from 'shared'
import { nullObjectId } from 'testlib'
import { Errors } from '../__helpers__'
import { Fixture, setupPurchaseData } from './purchases.fixture'

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
        // 상황: 유효한 구매 요청할 때
        describe('with a valid purchase request', () => {
            let purchase: PurchaseDto
            let availableTickets: TicketDto[]
            let purchaseItems: PurchaseItemDto[]

            beforeEach(async () => {
                const data = await setupPurchaseData(fix)
                availableTickets = data.availableTickets
                purchaseItems = data.purchaseItems

                const { body } = await fix.httpClient
                    .post('/purchases')
                    .body({ customerId: fix.customer.id, totalPrice: 1, purchaseItems })
                    .created()

                purchase = body
            })

            // 기대 결과: 올바른 정보로 구매 기록을 생성한다.
            it('creates a purchase record with the correct details', async () => {
                expect(purchase).toEqual({
                    id: expect.any(String),
                    createdAt: expect.any(Date),
                    updatedAt: expect.any(Date),
                    paymentId: expect.any(String),
                    customerId: fix.customer.id,
                    totalPrice: 1,
                    purchaseItems
                })
            })

            // 기대 결과: 연관된 결제 기록을 생성한다.
            it('creates a corresponding payment record', async () => {
                const payments = await fix.paymentsService.getPayments([purchase.paymentId])
                expect(payments[0].amount).toEqual(purchase.totalPrice)
            })

            // 기대 결과: 구매된 티켓의 상태를 "판매됨"으로 변경한다.
            it('updates the status of purchased tickets to "sold"', async () => {
                const ticketIds = purchaseItems.map((item) => item.ticketId)
                const retrievedTickets = await fix.ticketsService.getTickets(ticketIds)
                retrievedTickets.forEach((ticket) => expect(ticket.status).toBe(TicketStatus.Sold))
            })

            // 기대 결과: 구매되지 않은 티켓의 상태는 그대로 유지한다.
            it('leaves other available tickets unchanged', async () => {
                const ticketIds = availableTickets.map((ticket) => ticket.id)
                const retrievedTickets = await fix.ticketsService.getTickets(ticketIds)
                retrievedTickets.forEach((ticket) =>
                    expect(ticket.status).toBe(TicketStatus.Available)
                )
            })
        })

        // 상황: 최대 구매 가능 수량을 초과했을 때
        describe('when the number of tickets exceeds the maximum limit', () => {
            // 기대 결과: 400 Bad Request 에러를 반환한다.
            it('returns a 400 Bad Request error', async () => {
                const { purchaseItems } = await setupPurchaseData(fix, {
                    holdCount: Rules.Ticket.maxTicketsPerPurchase + 1
                })

                await fix.httpClient
                    .post('/purchases')
                    .body({ customerId: fix.customer.id, totalPrice: 1, purchaseItems })
                    .badRequest({
                        ...Errors.TicketPurchase.MaxTicketsExceeded,
                        maxCount: expect.any(Number)
                    })
            })
        })

        // 상황: 구매 가능 시간이 지났을 때
        describe('when the purchase deadline has passed', () => {
            // 기대 결과: 400 Bad Request 에러를 반환한다.
            it('returns a 400 Bad Request error', async () => {
                const { purchaseItems } = await setupPurchaseData(fix, {
                    minutesFromNow: Rules.Ticket.purchaseDeadlineInMinutes
                })

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

        // 상황: 선점하지 않은 티켓을 구매하려고 할 때
        describe('when attempting to purchase unheld tickets', () => {
            // 기대 결과: 400 Bad Request 에러를 반환한다.
            it('returns a 400 Bad Request error', async () => {
                const { showtime, purchaseItems } = await setupPurchaseData(fix)
                await fix.ticketHoldingClient.releaseTickets(showtime.id, fix.customer.id)

                await fix.httpClient
                    .post('/purchases')
                    .body({ customerId: fix.customer.id, totalPrice: 1, purchaseItems })
                    .badRequest(Errors.TicketPurchase.TicketNotHeld)
            })
        })

        // 상황: 구매 완료 처리 중 내부 오류가 발생했을 때
        describe('when an internal error occurs during the completion phase', () => {
            let spyRollback: jest.SpyInstance

            beforeEach(() => {
                jest.spyOn(fix.ticketsService, 'updateTicketStatus').mockImplementationOnce(() => {
                    throw new Error('purchase error')
                })
                spyRollback = jest.spyOn(fix.ticketPurchaseProcessor, 'rollbackPurchase')
            })

            // 기대 결과: 500 Internal Server Error를 반환하고 구매 롤백 로직을 실행한다.
            it('returns a 500 Internal Server Error and triggers the purchase rollback logic', async () => {
                const { purchaseItems } = await setupPurchaseData(fix)
                await fix.httpClient
                    .post('/purchases')
                    .body({ customerId: fix.customer.id, totalPrice: 1, purchaseItems })
                    .internalServerError()

                expect(spyRollback).toHaveBeenCalledTimes(1)
            })
        })
    })

    describe('GET /purchases/:purchaseId', () => {
        // 상황: 구매 내역이 존재할 때
        describe('when the purchase exists', () => {
            let purchase: PurchaseDto

            beforeEach(async () => {
                purchase = await fix.purchasesService.createPurchase({
                    customerId: fix.customer.id,
                    totalPrice: 1,
                    purchaseItems: [{ type: PurchaseItemType.Ticket, ticketId: nullObjectId }]
                })
            })

            // 기대 결과: 구매 상세 정보를 반환한다.
            it('returns the purchase details', async () => {
                await fix.httpClient.get(`/purchases/${purchase.id}`).ok(purchase)
            })
        })
    })
})
