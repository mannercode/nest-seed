import { pickIds } from '@mannercode/common'
import { toAny } from '@mannercode/testing'
import { TicketStatus, type PurchaseRecordDto, type TicketDto } from 'cores'
import { Errors, getPayments, getTickets } from '../__helpers__'
import { buildCreatePurchaseDto, type PurchaseFixture } from './purchase.fixture'

describe('PurchaseService', () => {
    let fix: PurchaseFixture

    beforeEach(async () => {
        const { createPurchaseFixture } = await import('./purchase.fixture')
        fix = await createPurchaseFixture()
    })
    afterEach(() => fix.teardown())

    describe('POST /purchases', () => {
        describe('고객이 티켓을 보유하고 있을 때', () => {
            let heldTickets: TicketDto[]

            beforeEach(async () => {
                const { createShowtimeAndTickets, holdTickets } = await import('./purchase.fixture')
                const tickets = await createShowtimeAndTickets(fix)
                heldTickets = await holdTickets(fix, tickets)
            })

            it('생성된 구매를 반환한다', async () => {
                const createDto = buildCreatePurchaseDto(heldTickets)

                await fix.httpClient
                    .post('/purchases')
                    .body(createDto)
                    .created({
                        ...createDto,
                        createdAt: expect.any(Date),
                        id: expect.any(String),
                        paymentId: expect.any(String),
                        updatedAt: expect.any(Date)
                    })
            })

            describe('구매가 생성되었을 때', () => {
                let purchaseRecord: PurchaseRecordDto

                beforeEach(async () => {
                    const createDto = buildCreatePurchaseDto(heldTickets)
                    const { body } = await fix.httpClient
                        .post('/purchases')
                        .body(createDto)
                        .created()
                    purchaseRecord = body
                })

                it('결제 기록을 생성한다', async () => {
                    const payments = await getPayments(fix, [purchaseRecord.paymentId])

                    expect(payments[0].amount).toEqual(purchaseRecord.totalPrice)
                })

                it('구매된 티켓을 `Sold`로 표시한다', async () => {
                    const soldTickets = await getTickets(fix, pickIds(heldTickets))

                    expect(soldTickets.every((t) => t.status === TicketStatus.Sold)).toBe(true)
                })
            })

            describe('티켓 수가 최대치를 초과할 때', () => {
                beforeEach(async () => {
                    const { Rules } = await import('config')
                    toAny(Rules).Ticket.maxTicketsPerPurchase = heldTickets.length - 1
                })

                it('400 Bad Request를 반환한다', async () => {
                    const createDto = buildCreatePurchaseDto(heldTickets)

                    await fix.httpClient
                        .post('/purchases')
                        .body(createDto)
                        .badRequest(Errors.Purchase.LimitExceeded(expect.any(Number)))
                })
            })

            describe('구매 가능 시간이 종료되었을 때', () => {
                beforeEach(async () => {
                    const { Rules } = await import('config')
                    toAny(Rules).Ticket.purchaseCutoffMinutes =
                        Rules.Ticket.purchaseCutoffMinutes + 2
                })

                it('400 Bad Request를 반환한다', async () => {
                    const createDto = buildCreatePurchaseDto(heldTickets)

                    await fix.httpClient
                        .post('/purchases')
                        .body(createDto)
                        .badRequest(
                            Errors.Purchase.WindowClosed(
                                expect.any(Number),
                                expect.any(String),
                                expect.any(String)
                            )
                        )
                })
            })

            describe('내부 오류가 발생할 때', () => {
                let rollbackPurchaseSpy: jest.SpyInstance

                beforeEach(async () => {
                    const { TicketsService } = await import('cores')
                    const ticketsService = fix.module.get(TicketsService)

                    jest.spyOn(ticketsService, 'updateStatusMany').mockImplementationOnce(() => {
                        throw new Error('purchase error')
                    })

                    const { TicketPurchaseService } = await import('applications')
                    const ticketPurchaseService = fix.module.get(TicketPurchaseService)

                    rollbackPurchaseSpy = jest.spyOn(ticketPurchaseService, 'rollbackPurchase')
                })

                it('구매를 롤백한다', async () => {
                    const createDto = buildCreatePurchaseDto(heldTickets)

                    await fix.httpClient.post('/purchases').body(createDto).internalServerError()

                    expect(rollbackPurchaseSpy).toHaveBeenCalledTimes(1)
                })
            })

            describe('구매 완료가 실패할 때', () => {
                it('결제를 취소하고 구매 기록을 삭제한다', async () => {
                    const { TicketPurchaseService } = await import('applications')
                    const { PurchaseRecordsService } = await import('cores')
                    const { PaymentsService } = await import('infrastructures')
                    const ticketPurchaseService = fix.module.get(TicketPurchaseService)
                    const purchaseRecordsService = fix.module.get(PurchaseRecordsService)
                    const paymentsService = fix.module.get(PaymentsService)

                    jest.spyOn(ticketPurchaseService, 'completePurchase').mockImplementationOnce(
                        () => {
                            throw new Error('complete failed')
                        }
                    )
                    const rollbackPurchaseSpy = jest.spyOn(
                        ticketPurchaseService,
                        'rollbackPurchase'
                    )
                    const deletePurchaseRecordSpy = jest.spyOn(purchaseRecordsService, 'deleteMany')
                    const cancelPaymentSpy = jest.spyOn(paymentsService, 'cancel')

                    const createDto = buildCreatePurchaseDto(heldTickets)

                    await fix.httpClient.post('/purchases').body(createDto).internalServerError()

                    expect(rollbackPurchaseSpy).toHaveBeenCalledTimes(1)
                    expect(deletePurchaseRecordSpy).toHaveBeenCalledTimes(1)
                    expect(cancelPaymentSpy).toHaveBeenCalledTimes(1)
                })
            })

            describe('티켓이 이미 판매된 상태일 때', () => {
                beforeEach(async () => {
                    const createDto = buildCreatePurchaseDto(heldTickets)
                    await fix.httpClient.post('/purchases').body(createDto).created()
                })

                it('409 Conflict를 반환한다', async () => {
                    const createDto = buildCreatePurchaseDto(heldTickets)

                    await fix.httpClient
                        .post('/purchases')
                        .body(createDto)
                        .conflict(Errors.Purchase.AlreadySold(pickIds(heldTickets)))
                })
            })

            describe('구매 기록 생성이 실패할 때', () => {
                it('결제를 취소한다', async () => {
                    const { PurchaseRecordsService } = await import('cores')
                    const { PaymentsService } = await import('infrastructures')
                    const purchaseRecordsService = fix.module.get(PurchaseRecordsService)
                    const paymentsService = fix.module.get(PaymentsService)

                    jest.spyOn(purchaseRecordsService, 'create').mockImplementationOnce(() => {
                        throw new Error('record creation failed')
                    })
                    const cancelPaymentSpy = jest.spyOn(paymentsService, 'cancel')

                    const createDto = buildCreatePurchaseDto(heldTickets)

                    await fix.httpClient.post('/purchases').body(createDto).internalServerError()

                    expect(cancelPaymentSpy).toHaveBeenCalledTimes(1)
                })
            })
        })

        describe('티켓이 보유되지 않았을 때', () => {
            let tickets: TicketDto[]

            beforeEach(async () => {
                const { createShowtimeAndTickets } = await import('./purchase.fixture')
                tickets = await createShowtimeAndTickets(fix)
            })

            it('400 Bad Request를 반환한다', async () => {
                const createDto = buildCreatePurchaseDto(tickets.slice(0, 1))

                await fix.httpClient
                    .post('/purchases')
                    .body(createDto)
                    .badRequest(Errors.Purchase.NotHeld())
            })
        })
    })
})
