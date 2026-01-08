import { TicketStatus } from 'apps/cores'
import { pickIds } from 'common'
import { toAny } from 'testlib'
import { Errors, getPayments, getTickets } from '../__helpers__'
import { buildCreatePurchaseDto, type PurchaseFixture } from './purchase.fixture'
import type { PurchaseRecordDto, TicketDto } from 'apps/cores'

describe('PurchaseService', () => {
    let fix: PurchaseFixture

    beforeEach(async () => {
        const { createPurchaseFixture } = await import('./purchase.fixture')
        fix = await createPurchaseFixture()
    })
    afterEach(() => fix.teardown())

    describe('POST /purchases', () => {
        // 고객이 티켓을 보유하고 있을 때
        describe('when the customer holds tickets', () => {
            let heldTickets: TicketDto[]

            beforeEach(async () => {
                const { createShowtimeAndTickets, holdTickets } = await import('./purchase.fixture')
                const tickets = await createShowtimeAndTickets(fix)
                heldTickets = await holdTickets(fix, tickets)
            })

            // 생성된 구매를 반환한다
            it('returns the created purchase', async () => {
                const createDto = buildCreatePurchaseDto(heldTickets)

                await fix.httpClient
                    .post('/purchases')
                    .body(createDto)
                    .created({
                        ...createDto,
                        id: expect.any(String),
                        createdAt: expect.any(Date),
                        updatedAt: expect.any(Date),
                        paymentId: expect.any(String)
                    })
            })

            // 구매가 생성되었을 때
            describe('when the purchase is created', () => {
                let purchase: PurchaseRecordDto

                beforeEach(async () => {
                    const createDto = buildCreatePurchaseDto(heldTickets)
                    const { body } = await fix.httpClient
                        .post('/purchases')
                        .body(createDto)
                        .created()
                    purchase = body
                })

                // 결제 기록을 생성한다
                it('creates the payment record', async () => {
                    const payments = await getPayments(fix, [purchase.paymentId])

                    expect(payments[0].amount).toEqual(purchase.totalPrice)
                })

                // 구매된 티켓을 `Sold`로 표시한다
                it('marks purchased tickets as `Sold`', async () => {
                    const soldTickets = await getTickets(fix, pickIds(heldTickets))

                    expect(soldTickets.every((t) => t.status === TicketStatus.Sold)).toBe(true)
                })
            })

            // 티켓 수가 최대치를 초과할 때
            describe('when the ticket count exceeds the maximum', () => {
                beforeEach(async () => {
                    const { Rules } = await import('shared')
                    toAny(Rules).Ticket.maxTicketsPerPurchase = heldTickets.length - 1
                })

                // 400 Bad Request를 반환한다
                it('returns 400 Bad Request', async () => {
                    const createDto = buildCreatePurchaseDto(heldTickets)

                    await fix.httpClient
                        .post('/purchases')
                        .body(createDto)
                        .badRequest({
                            ...Errors.TicketPurchase.MaxTicketsExceeded,
                            maxCount: expect.any(Number)
                        })
                })
            })

            // 구매 가능 시간이 종료되었을 때
            describe('when the purchase window is closed', () => {
                beforeEach(async () => {
                    const { Rules } = await import('shared')
                    toAny(Rules).Ticket.purchaseCutoffMinutes =
                        Rules.Ticket.purchaseCutoffMinutes + 2
                })

                // 400 Bad Request를 반환한다
                it('returns 400 Bad Request', async () => {
                    const createDto = buildCreatePurchaseDto(heldTickets)

                    await fix.httpClient
                        .post('/purchases')
                        .body(createDto)
                        .badRequest({
                            ...Errors.TicketPurchase.WindowClosed,
                            purchaseCutoffMinutes: expect.any(Number),
                            purchaseWindowCloseTime: expect.any(String),
                            startTime: expect.any(String)
                        })
                })
            })

            // 내부 오류가 발생할 때
            describe('when an internal error occurs', () => {
                let rollbackPurchaseSpy: jest.SpyInstance

                beforeEach(async () => {
                    const { TicketsService } = await import('apps/cores')
                    const ticketsService = fix.module.get(TicketsService)

                    jest.spyOn(ticketsService, 'updateStatusMany').mockImplementationOnce(() => {
                        throw new Error('purchase error')
                    })

                    const { TicketPurchaseService } = await import('apps/applications')
                    const ticketPurchaseService = fix.module.get(TicketPurchaseService)

                    rollbackPurchaseSpy = jest.spyOn(ticketPurchaseService, 'rollbackPurchase')
                })

                // 구매를 롤백한다
                it('rolls back the purchase', async () => {
                    const createDto = buildCreatePurchaseDto(heldTickets)

                    await fix.httpClient.post('/purchases').body(createDto).internalServerError()

                    expect(rollbackPurchaseSpy).toHaveBeenCalledTimes(1)
                })
            })
        })

        // 티켓이 보유되지 않았을 때
        describe('when the tickets are not held', () => {
            let tickets: TicketDto[]

            beforeEach(async () => {
                const { createShowtimeAndTickets } = await import('./purchase.fixture')
                tickets = await createShowtimeAndTickets(fix)
            })

            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                const createDto = buildCreatePurchaseDto(tickets.slice(0, 1))

                await fix.httpClient
                    .post('/purchases')
                    .body(createDto)
                    .badRequest(Errors.TicketPurchase.TicketNotHeld)
            })
        })
    })
})
