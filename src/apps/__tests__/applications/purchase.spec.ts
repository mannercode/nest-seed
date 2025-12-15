import { CreatePurchaseDto } from 'apps/applications'
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
        describe('when the payload is valid', () => {
            let createDto: CreatePurchaseDto
            let createdPurchase: PurchaseRecordDto

            beforeEach(async () => {
                createDto = buildCreatePurchaseDto(fix.customer, fix.heldTickets)

                const { body } = await fix.httpClient.post('/purchases').body(createDto).created()

                createdPurchase = body
            })

            it('returns the created purchase', async () => {
                const createDto = buildCreatePurchaseDto(fix.customer, fix.heldTickets)

                await fix.httpClient
                    .post('/purchases')
                    .body(createDto)
                    .created({
                        id: expect.any(String),
                        createdAt: expect.any(Date),
                        updatedAt: expect.any(Date),
                        paymentId: expect.any(String),
                        ...createDto
                    })
            })

            // "생성한다"가 아니라 "DB에 존재한다"
            // it('has persisted the payment record', async () => {
            // 결제 기록을 생성한다
            it('creates the payment record', async () => {
                const payments = await getPayments(fix, [createdPurchase.paymentId])

                expect(payments[0].amount).toEqual(createdPurchase.totalPrice)
            })

            it('marks purchased tickets as `Sold`', async () => {
                const soldTickets = await getTickets(fix, pickIds(fix.heldTickets))

                expect(soldTickets.map((ticket) => ticket.status)).toEqual(
                    Array(soldTickets.length).fill(TicketStatus.Sold)
                )
            })

            it('keeps unpurchased tickets unchanged', async () => {
                const remainingTickets = await getTickets(fix, pickIds(fix.availableTickets))

                expect(remainingTickets.map((ticket) => ticket.status)).toEqual(
                    Array(remainingTickets.length).fill(TicketStatus.Available)
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
