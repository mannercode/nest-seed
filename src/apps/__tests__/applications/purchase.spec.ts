import { PurchaseRecordDto, TicketStatus } from 'apps/cores'
import { pickIds } from 'common'
import { toAny } from 'testlib'
import { Errors, getPayments, getTickets } from '../__helpers__'
import { buildCreatePurchaseDto, type PurchaseFixture } from './purchase.fixture'

describe('PurchaseService', () => {
    let fix: PurchaseFixture

    beforeEach(async () => {
        const { createPurchaseFixture } = await import('./purchase.fixture')
        fix = await createPurchaseFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('POST /purchases', () => {
        it('returns the created purchase', async () => {
            const createDto = buildCreatePurchaseDto(fix.customer, fix.heldTickets)

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
                const createDto = buildCreatePurchaseDto(fix.customer, fix.heldTickets)
                const { body } = await fix.httpClient.post('/purchases').body(createDto).created()
                purchase = body
            })

            it('creates the payment record', async () => {
                const payments = await getPayments(fix, [purchase.paymentId])

                expect(payments[0].amount).toEqual(purchase.totalPrice)
            })

            it('marks purchased tickets as `Sold`', async () => {
                const soldTickets = await getTickets(fix, pickIds(fix.heldTickets))

                expect(soldTickets.every((t) => t.status === TicketStatus.Sold)).toBe(true)
            })

            it('keeps unpurchased tickets unchanged', async () => {
                const remainingTickets = await getTickets(fix, pickIds(fix.availableTickets))

                expect(remainingTickets.every((t) => t.status === TicketStatus.Available)).toBe(
                    true
                )
            })
        })

        describe('when the ticket count exceeds the maximum', () => {
            beforeEach(async () => {
                const { Rules } = await import('shared')
                toAny(Rules).Ticket.maxTicketsPerPurchase = fix.heldTickets.length - 1
            })

            it('returns 400 Bad Request', async () => {
                const createDto = buildCreatePurchaseDto(fix.customer, fix.heldTickets)

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
            it('returns 400 Bad Request', async () => {
                const createDto = buildCreatePurchaseDto(
                    fix.customer,
                    fix.closedTickets.slice(0, 2)
                )

                await fix.httpClient
                    .post('/purchases')
                    .body(createDto)
                    .badRequest({
                        ...Errors.TicketPurchase.WindowClosed,
                        purchaseWindowCloseOffsetMinutes: expect.any(Number),
                        purchaseWindowCloseTime: expect.any(String),
                        startTime: expect.any(String)
                    })
            })
        })

        describe('when purchasing unheld tickets', () => {
            it('returns 400 Bad Request', async () => {
                const createDto = buildCreatePurchaseDto(
                    fix.customer,
                    fix.availableTickets.slice(2)
                )

                await fix.httpClient
                    .post('/purchases')
                    .body(createDto)
                    .badRequest(Errors.TicketPurchase.TicketNotHeld)
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

                const { TicketPurchasService } = await import('apps/applications')
                const ticketPurchaseService = fix.module.get(TicketPurchasService)

                rollbackPurchaseSpy = jest.spyOn(ticketPurchaseService, 'rollbackPurchase')
            })

            it('returns 500 and rolls back the purchase', async () => {
                const createDto = buildCreatePurchaseDto(fix.customer, fix.heldTickets)

                await fix.httpClient.post('/purchases').body(createDto).internalServerError()

                expect(rollbackPurchaseSpy).toHaveBeenCalledTimes(1)
            })
        })
    })
})
