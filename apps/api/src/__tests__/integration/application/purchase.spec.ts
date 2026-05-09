import { pickIds } from '@mannercode/common'
import { toAny } from '@mannercode/testing'
import { TicketStatus, type PurchaseRecordDto, type TicketDto } from 'core'
import { Errors, getPayments, getTickets } from '../helpers'
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
                // completePurchase 진입 직후의 로그에서 throw → completePurchase 안에서 터져
                // PurchaseService 의 catch 블록 (rollbackPurchase + deleteMany + cancel) 이 발화한다.
                // 특정 메서드 호출이 아닌 관측 가능한 로그 지점을 트리거로 잡아 구현 디테일과 분리한다.
                beforeEach(async () => {
                    // resetModules:true 환경에서 production 코드가 실제로 사용하는
                    // Logger 와 같은 realm 의 클래스를 잡아야 spy 가 작동한다.
                    const { Logger } = await import('@nestjs/common')
                    jest.spyOn(Logger.prototype, 'log').mockImplementation(((message: any) => {
                        if (message === 'completePurchase') {
                            throw new Error('purchase error')
                        }
                    }) as any)
                })

                it('구매한 티켓을 Available 로 복구한다', async () => {
                    const createDto = buildCreatePurchaseDto(heldTickets)

                    await fix.httpClient.post('/purchases').body(createDto).internalServerError()

                    const { TicketsService } = await import('core')
                    const ticketsService = fix.module.get(TicketsService)
                    const tickets = await ticketsService.getMany(pickIds(heldTickets))
                    expect(tickets.every((t) => t.status === TicketStatus.Available)).toBe(true)
                })

                it('결제를 취소하고 구매 기록을 삭제한다', async () => {
                    const { PurchaseRecordsService } = await import('core')
                    const { PaymentsService } = await import('infrastructure')
                    const purchaseRecordsService = fix.module.get(PurchaseRecordsService)
                    const paymentsService = fix.module.get(PaymentsService)

                    const deletePurchaseRecordSpy = jest.spyOn(purchaseRecordsService, 'deleteMany')
                    const cancelPaymentSpy = jest.spyOn(paymentsService, 'cancel')

                    const createDto = buildCreatePurchaseDto(heldTickets)

                    await fix.httpClient.post('/purchases').body(createDto).internalServerError()

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
                    const { PurchaseRecordsService } = await import('core')
                    const { PaymentsService } = await import('infrastructure')
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
