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
        describe('when the customer holds tickets', () => {
            let heldTickets: TicketDto[]

            beforeEach(async () => {
                const { createShowtimeAndTickets, holdTickets } = await import('./purchase.fixture')
                const tickets = await createShowtimeAndTickets(fix)
                heldTickets = await holdTickets(fix, tickets)
            })

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

                it('creates the payment record', async () => {
                    const payments = await getPayments(fix, [purchase.paymentId])

                    expect(payments[0].amount).toEqual(purchase.totalPrice)
                })

                it('marks purchased tickets as `Sold`', async () => {
                    const soldTickets = await getTickets(fix, pickIds(heldTickets))

                    expect(soldTickets.every((t) => t.status === TicketStatus.Sold)).toBe(true)
                })
            })

            describe('when the ticket count exceeds the maximum', () => {
                beforeEach(async () => {
                    const { Rules } = await import('shared')
                    toAny(Rules).Ticket.maxTicketsPerPurchase = heldTickets.length - 1
                })

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

            describe('when the purchase window is closed', () => {
                beforeEach(async () => {
                    const { Rules } = await import('shared')
                    toAny(Rules).Ticket.purchaseCutoffMinutes =
                        Rules.Ticket.purchaseCutoffMinutes + 2
                })

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

                it('rolls back the purchase', async () => {
                    const createDto = buildCreatePurchaseDto(heldTickets)

                    await fix.httpClient.post('/purchases').body(createDto).internalServerError()

                    expect(rollbackPurchaseSpy).toHaveBeenCalledTimes(1)
                })
            })
        })

        describe('when the tickets are not held', () => {
            let tickets: TicketDto[]

            beforeEach(async () => {
                const { createShowtimeAndTickets } = await import('./purchase.fixture')
                tickets = await createShowtimeAndTickets(fix)
            })

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
