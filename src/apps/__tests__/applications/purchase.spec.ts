import { HttpStatus } from '@nestjs/common'
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

                // 보유한 티켓을 해제한다
                it('releases held tickets', async () => {
                    const { TicketHoldingService } = await import('apps/cores')
                    const ticketHoldingService = fix.module.get(TicketHoldingService)

                    const heldTicketIds = await ticketHoldingService.searchHeldTicketIds(
                        heldTickets[0].showtimeId,
                        purchase.customerId
                    )

                    expect(heldTicketIds).toEqual([])
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

            // 결제 생성이 실패할 때
            describe('when payment creation fails', () => {
                let rollbackPurchaseSpy: jest.SpyInstance
                let releaseHoldsSpy: jest.SpyInstance
                let emitCanceledSpy: jest.SpyInstance

                beforeEach(async () => {
                    const { TicketPurchaseService, PurchaseService } =
                        await import('apps/applications')
                    const ticketPurchaseService = fix.module.get(TicketPurchaseService)
                    const purchaseService = fix.module.get(PurchaseService)

                    jest.spyOn(ticketPurchaseService, 'validatePurchase').mockResolvedValue({
                        ticketIds: [],
                        showtimeIds: []
                    })

                    rollbackPurchaseSpy = jest.spyOn(ticketPurchaseService, 'rollbackPurchase')
                    releaseHoldsSpy = jest.spyOn(ticketPurchaseService, 'releaseHolds')
                    emitCanceledSpy = jest.spyOn(
                        ticketPurchaseService,
                        'emitTicketPurchaseCanceled'
                    )

                    const { PaymentsClient } = await import('apps/infrastructures')
                    const paymentsClient = fix.module.get(PaymentsClient)

                    jest.spyOn(paymentsClient, 'create').mockRejectedValue(
                        new Error('payment error')
                    )

                    const createDto = buildCreatePurchaseDto(heldTickets)

                    await expect(purchaseService.processPurchase(createDto)).rejects.toThrow(
                        'payment error'
                    )
                })

                // 보상이 실행되지 않는다
                it('does not run compensations without ids', () => {
                    expect(rollbackPurchaseSpy).not.toHaveBeenCalled()
                    expect(releaseHoldsSpy).not.toHaveBeenCalled()
                    expect(emitCanceledSpy).not.toHaveBeenCalled()
                })
            })

            // 내부 오류가 발생할 때
            describe('when an internal error occurs', () => {
                let rollbackPurchaseSpy: jest.SpyInstance
                let paymentsCreateSpy: jest.SpyInstance
                let purchaseRecordsCreateSpy: jest.SpyInstance

                beforeEach(async () => {
                    const { TicketsService } = await import('apps/cores')
                    const ticketsService = fix.module.get(TicketsService)

                    jest.spyOn(ticketsService, 'updateStatusMany').mockImplementationOnce(() => {
                        throw new Error('purchase error')
                    })

                    const { TicketPurchaseService } = await import('apps/applications')
                    const ticketPurchaseService = fix.module.get(TicketPurchaseService)

                    rollbackPurchaseSpy = jest.spyOn(ticketPurchaseService, 'rollbackPurchase')

                    const { PaymentsService } = await import('apps/infrastructures')
                    const paymentsService = fix.module.get(PaymentsService)
                    paymentsCreateSpy = jest.spyOn(paymentsService, 'create')

                    const { PurchaseRecordsService } = await import('apps/cores')
                    const purchaseRecordsService = fix.module.get(PurchaseRecordsService)
                    purchaseRecordsCreateSpy = jest.spyOn(purchaseRecordsService, 'create')
                })

                // 구매를 롤백한다
                it('rolls back the purchase', async () => {
                    const createDto = buildCreatePurchaseDto(heldTickets)

                    await fix.httpClient.post('/purchases').body(createDto).internalServerError()

                    expect(rollbackPurchaseSpy).toHaveBeenCalledTimes(1)
                })

                // 결제/구매 기록과 보유 티켓을 정리한다
                it('cleans up payment, purchase, and holds', async () => {
                    const createDto = buildCreatePurchaseDto(heldTickets)

                    await fix.httpClient.post('/purchases').body(createDto).internalServerError()

                    expect(paymentsCreateSpy).toHaveBeenCalledTimes(1)
                    expect(purchaseRecordsCreateSpy).toHaveBeenCalledTimes(1)

                    const payment = await paymentsCreateSpy.mock.results[0].value
                    const purchase = await purchaseRecordsCreateSpy.mock.results[0].value

                    await expect(getPayments(fix, [payment.id])).rejects.toMatchObject({
                        status: HttpStatus.NOT_FOUND
                    })

                    const { PurchaseRecordsService, TicketHoldingService } =
                        await import('apps/cores')
                    const purchaseRecordsService = fix.module.get(PurchaseRecordsService)
                    const ticketHoldingService = fix.module.get(TicketHoldingService)

                    await expect(
                        purchaseRecordsService.getMany([purchase.id])
                    ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND })

                    const heldTicketIds = await ticketHoldingService.searchHeldTicketIds(
                        heldTickets[0].showtimeId,
                        createDto.customerId
                    )

                    expect(heldTicketIds).toEqual([])
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
