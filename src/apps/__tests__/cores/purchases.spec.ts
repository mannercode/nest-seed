import {
    CreatePurchaseDto,
    PurchaseDto,
    PurchaseItemDto,
    PurchaseItemType,
    TicketStatus
} from 'apps/cores'
import { pickIds } from 'common'
import { Errors } from '../__helpers__'
import { getPayments, getTickets } from '../common.fixture'
import { buildCreatePurchaseDto, Fixture } from './purchases.fixture'

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
            let createDto: CreatePurchaseDto
            let purchase: PurchaseDto

            beforeEach(async () => {
                // Arrange
                const purchaseItems = fix.heldTickets.map(({ id }) => ({
                    type: PurchaseItemType.Ticket,
                    ticketId: id
                }))

                createDto = buildCreatePurchaseDto({
                    customerId: fix.customer.id,
                    purchaseItems
                })

                // Act
                const { body } = await fix.httpClient.post('/purchases').body(createDto).created()

                purchase = body
            })

            // 구매를 생성하고 반환한다
            it('creates and returns the purchase', async () => {
                expect(purchase).toEqual({
                    id: expect.any(String),
                    createdAt: expect.any(Date),
                    updatedAt: expect.any(Date),
                    paymentId: expect.any(String),
                    ...createDto
                })
            })

            // 연관된 결제 기록을 생성한다
            it('creates a corresponding payment record', async () => {
                const payments = await getPayments(fix, [purchase.paymentId])
                expect(payments[0].amount).toEqual(purchase.totalPrice)
            })

            // 구매한 티켓의 상태를 "판매됨"으로 변경한다
            it('Changes the status of purchased tickets to `Sold`', async () => {
                const soldTickets = await getTickets(fix, pickIds(fix.heldTickets))
                soldTickets.forEach((ticket) => expect(ticket.status).toBe(TicketStatus.Sold))
            })

            // 구매하지 않은 티켓의 상태는 그대로 유지한다
            it('leaves the status of unpurchased tickets unchanged', async () => {
                const remainingTickets = await getTickets(fix, pickIds(fix.availableTickets))
                remainingTickets.forEach((ticket) =>
                    expect(ticket.status).toBe(TicketStatus.Available)
                )
            })
        })

        // 최대 구매 수량을 초과한 경우
        describe('when the number of tickets exceeds the maximum', () => {
            let exceedingMaxPurchaseItems: PurchaseItemDto[]

            beforeEach(async () => {
                const { Rules } = await import('shared')
                Rules.Ticket.maxTicketsPerPurchase = fix.heldTickets.length - 1

                exceedingMaxPurchaseItems = fix.heldTickets.map(({ id }) => ({
                    type: PurchaseItemType.Ticket,
                    ticketId: id
                }))
            })

            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                const purchase: CreatePurchaseDto = {
                    customerId: fix.customer.id,
                    totalPrice: 1,
                    purchaseItems: exceedingMaxPurchaseItems
                }

                await fix.httpClient
                    .post('/purchases')
                    .body(purchase)
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
                const deadlineExceededPurchaseItems = [
                    { type: PurchaseItemType.Ticket, ticketId: fix.saleClosedTickets[0].id }
                ]

                await fix.httpClient
                    .post('/purchases')
                    .body({
                        customerId: fix.customer.id,
                        totalPrice: 1,
                        purchaseItems: deadlineExceededPurchaseItems
                    })
                    .badRequest({
                        ...Errors.TicketPurchase.DeadlineExceeded,
                        purchaseDeadlineInMinutes: expect.any(Number),
                        cutoffTime: expect.any(String),
                        startTime: expect.any(String)
                    })
            })
        })

        // 선점되지 않은 티켓을 구매하는 경우
        describe('when purchasing unheld tickets', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                const unheldPurchaseItems = [
                    { type: PurchaseItemType.Ticket, ticketId: fix.availableTickets[0].id }
                ]

                await fix.httpClient
                    .post('/purchases')
                    .body({
                        customerId: fix.customer.id,
                        totalPrice: 1,
                        purchaseItems: unheldPurchaseItems
                    })
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

            // 500 Internal Server Error를 반환하고 구매를 롤백한다
            it('returns 500 Internal Server Error and rolls back the purchase', async () => {
                await fix.httpClient
                    .post('/purchases')
                    .body({
                        customerId: fix.customer.id,
                        totalPrice: 1,
                        purchaseItems: fix.purchaseItems
                    })
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
