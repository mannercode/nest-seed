import { PurchaseDto, PurchaseItemDto, PurchaseItemType, TicketDto, TicketStatus } from 'apps/cores'
import { Rules } from 'shared'
import { nullObjectId } from 'testlib'
import { Errors } from '../__helpers__'
import { Fixture, setupPurchaseData } from './purchases.fixture'

describe('Purchases', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./purchases.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('POST /purchases', () => {
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

        // 구매 요청을 성공적으로 처리해야 한다
        it('Should successfully process a purchase request', async () => {
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

        // 결제 정보를 조회할 수 있어야 한다
        it('Should allow retrieving payment details', async () => {
            const payments = await fix.paymentsService.getPayments([purchase.paymentId])
            expect(payments[0].amount).toEqual(purchase.totalPrice)
        })

        // 구매한 티켓은 sold 상태여야 한다
        it('Should mark purchased tickets as sold', async () => {
            const ticketIds = purchaseItems.map((item) => item.ticketId)
            const retrievedTickets = await fix.ticketsService.getTickets(ticketIds)
            retrievedTickets.forEach((ticket) => expect(ticket.status).toBe(TicketStatus.Sold))
        })

        // 구매하지 않은 티켓은 available 상태여야 한다
        it('Should keep unpurchased tickets in available status', async () => {
            const ticketIds = availableTickets.map((ticket) => ticket.id)
            const retrievedTickets = await fix.ticketsService.getTickets(ticketIds)
            retrievedTickets.forEach((ticket) => expect(ticket.status).toBe(TicketStatus.Available))
        })
    })

    describe('GET /purchases/:purchaseId', () => {
        let purchase: PurchaseDto

        beforeEach(async () => {
            purchase = await fix.purchasesService.createPurchase({
                customerId: fix.customer.id,
                totalPrice: 1,
                purchaseItems: [{ type: PurchaseItemType.Ticket, ticketId: nullObjectId }]
            })
        })

        // 구매 상세 정보를 반환해야 한다.
        it('Should return purchase details', async () => {
            await fix.httpClient.get(`/purchases/${purchase.id}`).ok(purchase)
        })
    })

    describe('Verify purchase availability', () => {
        // 최대 구매 수량을 초과하면 BAD_REQUEST(400)를 반환해야 한다
        it('Should return BAD_REQUEST(400) if the purchase exceeds the maximum quantity', async () => {
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

        // 구매 가능 시간을 초과하면 BAD_REQUEST(400)를 반환해야 한다
        it('Should return BAD_REQUEST(400) if the purchase deadline is exceeded', async () => {
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

        // 선점되지 않은 티켓을 구매하려하면 BAD_REQUEST(400)를 반환해야 한다
        it('Should return BAD_REQUEST(400) if attempting to purchase unheld tickets', async () => {
            const { showtime, purchaseItems } = await setupPurchaseData(fix)
            await fix.ticketHoldingClient.releaseTickets(showtime.id, fix.customer.id)

            await fix.httpClient
                .post('/purchases')
                .body({ customerId: fix.customer.id, totalPrice: 1, purchaseItems })
                .badRequest(Errors.TicketPurchase.TicketNotHeld)
        })
    })

    describe('errors', () => {
        // 구매 완료 단계에서 오류가 발생하면 InternalServerError(500)를 반환해야 한다
        it('Should return InternalServerError(500) if an error occurs in the purchase completion phase', async () => {
            const { purchaseItems } = await setupPurchaseData(fix)

            jest.spyOn(fix.ticketsService, 'updateTicketStatus').mockImplementationOnce(() => {
                throw new Error('purchase error')
            })

            const spyRollback = jest.spyOn(fix.ticketPurchaseProcessor, 'rollbackPurchase')

            await fix.httpClient
                .post('/purchases')
                .body({ customerId: fix.customer.id, totalPrice: 1, purchaseItems })
                .internalServerError()

            expect(spyRollback).toHaveBeenCalledTimes(1)
        })
    })
})
