import { pickIds } from '@mannercode/common'
import { TicketStatus, type TicketDto } from 'core'
import {
    Errors,
    getPayments,
    getTickets,
    overrideConfigGetter,
    type AppTestContext
} from '../helpers'
import { buildCreatePurchaseDto } from './purchase.utils'

describe('PurchaseService', () => {
    let fix: AppTestContext

    beforeEach(async () => {
        const { createAppTestContext } = await import('../helpers')
        fix = await createAppTestContext()
    })
    afterEach(() => fix.teardown())

    describe('POST /purchases', () => {
        describe('고객이 티켓을 보유하고 있을 때', () => {
            let heldTickets: TicketDto[]

            beforeEach(async () => {
                const { createShowtimeAndTickets, holdTickets } = await import('./purchase.utils')
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

            it('구매 생성 시 결제 기록이 생성된다', async () => {
                const createDto = buildCreatePurchaseDto(heldTickets)
                const { body: purchaseRecord } = await fix.httpClient
                    .post('/purchases')
                    .body(createDto)
                    .created()

                const payments = await getPayments(fix, [purchaseRecord.paymentId])

                expect(payments[0].amount).toEqual(purchaseRecord.totalPrice)
            })

            it('구매 생성 시 티켓 상태가 Sold로 바뀐다', async () => {
                const createDto = buildCreatePurchaseDto(heldTickets)
                await fix.httpClient.post('/purchases').body(createDto).created()

                const soldTickets = await getTickets(fix, pickIds(heldTickets))

                expect(soldTickets.every((t) => t.status === TicketStatus.Sold)).toBe(true)
            })

            it('티켓 수가 최대치를 초과하면 400을 반환한다', async () => {
                await overrideConfigGetter(fix.module, 'ticket', {
                    maxPerPurchase: heldTickets.length - 1
                })

                const createDto = buildCreatePurchaseDto(heldTickets)

                await fix.httpClient
                    .post('/purchases')
                    .body(createDto)
                    .badRequest(Errors.Purchase.LimitExceeded(expect.any(Number)))
            })

            it('구매 가능 시간이 종료되면 400을 반환한다', async () => {
                const { AppConfigService } = await import('config')
                const config = fix.module.get(AppConfigService)
                await overrideConfigGetter(fix.module, 'ticket', {
                    purchaseCutoffMinutes: config.ticket.purchaseCutoffMinutes + 2
                })

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

            describe('내부 오류로 completePurchase가 실패할 때', () => {
                // completePurchase 진입 직후의 로그에서 throw → completePurchase 안에서 터져
                // PurchaseService의 catch 블록(rollbackPurchase + deleteMany + cancel)이 실행된다.
                // 특정 메서드 호출이 아닌 관측 가능한 로그 지점을 트리거로 잡아 구현 디테일과 분리한다.
                beforeEach(async () => {
                    // resetModules:true 환경에서 프로덕션 코드가 사용하는 Logger와 같은 realm의
                    // 클래스를 잡아야 spy가 작동한다.
                    const { Logger } = await import('@nestjs/common')
                    jest.spyOn(Logger.prototype, 'log').mockImplementation(((message: any) => {
                        if (message === 'completePurchase') {
                            throw new Error('purchase error')
                        }
                    }) as any)
                })

                it('구매한 티켓을 Available로 되돌린다', async () => {
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

            it('이미 판매된 티켓을 다시 구매하려 하면 409를 반환한다', async () => {
                const createDto = buildCreatePurchaseDto(heldTickets)
                await fix.httpClient.post('/purchases').body(createDto).created()

                await fix.httpClient
                    .post('/purchases')
                    .body(createDto)
                    .conflict(Errors.Purchase.AlreadySold(pickIds(heldTickets)))
            })

            it('구매 기록 생성이 실패하면 결제가 취소된다', async () => {
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

        it('티켓을 보유하지 않은 채로 구매하면 400을 반환한다', async () => {
            const { createShowtimeAndTickets } = await import('./purchase.utils')
            const tickets = await createShowtimeAndTickets(fix)

            const createDto = buildCreatePurchaseDto(tickets.slice(0, 1))

            await fix.httpClient
                .post('/purchases')
                .body(createDto)
                .badRequest(Errors.Purchase.NotHeld())
        })
    })
})
