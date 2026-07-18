import { ensure, pickIds, Require } from '@mannercode/common'
import { oid } from '@mannercode/testing'
import { TicketStatus, type TicketDto, type UserDto } from 'core'
import { PaymentStatus } from 'infrastructure'
import {
    createAndLoginUser,
    Errors,
    getPayments,
    getTickets,
    overrideConfigGetter,
    type AppTestContext
} from '../helpers'
import { buildCreatePurchaseDto } from './purchase.utils'

describe('PurchaseService', () => {
    let fix: AppTestContext
    let user: UserDto
    let accessToken: string

    beforeEach(async () => {
        const { createAppTestContext } = await import('../helpers')
        fix = await createAppTestContext()
        ;({ user, accessToken } = await createAndLoginUser(fix))
    })
    afterEach(() => fix.teardown())

    describe('POST /purchases', () => {
        describe('고객이 티켓을 보유하고 있을 때', () => {
            let heldTickets: TicketDto[]

            beforeEach(async () => {
                const { createShowtimeAndTickets, holdTickets } = await import('./purchase.utils')
                const tickets = await createShowtimeAndTickets(fix)
                heldTickets = await holdTickets(fix, user.id, tickets)
            })

            it('생성된 구매를 반환한다', async () => {
                const createDto = buildCreatePurchaseDto(heldTickets)

                await fix.httpClient
                    .post('/purchases')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body(createDto)
                    .created({
                        ...createDto,
                        userId: user.id,
                        createdAt: expect.any(Date),
                        id: expect.any(String),
                        paymentId: expect.any(String),
                        updatedAt: expect.any(Date)
                    })
            })

            it('구매하면 결제 기록이 생성된다', async () => {
                const createDto = buildCreatePurchaseDto(heldTickets)
                const { body: purchaseRecord } = await fix.httpClient
                    .post('/purchases')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body(createDto)
                    .created()

                const payments = await getPayments(fix, [purchaseRecord.paymentId])

                expect(ensure(payments[0]).amount).toEqual(purchaseRecord.totalPrice)
            })

            it('구매하면 티켓 상태가 판매 완료로 바뀐다', async () => {
                const createDto = buildCreatePurchaseDto(heldTickets)
                await fix.httpClient
                    .post('/purchases')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body(createDto)
                    .created()

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
                    .headers({ Authorization: `Bearer ${accessToken}` })
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
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body(createDto)
                    .badRequest(
                        Errors.Purchase.WindowClosed(
                            expect.any(Number),
                            expect.any(String),
                            expect.any(String)
                        )
                    )
            })

            it('금액이 서버 계산과 다르면 400을 반환한다', async () => {
                const createDto = buildCreatePurchaseDto(heldTickets, { totalPrice: 1 })

                await fix.httpClient
                    .post('/purchases')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body(createDto)
                    .badRequest(Errors.Purchase.TotalPriceMismatch(expect.any(Number), 1))
            })

            describe('completePurchase 중 내부 오류가 날 때', () => {
                // `completePurchase`가 처음 기록하는 로그를 기준으로 예외를 던진다.
                // 그러면 `PurchaseService`의 catch 블록이 실행되어 결제 취소와 구매 기록 삭제가 실행된다.
                // 티켓은 아직 전이 전이므로 되돌릴 것이 없다.
                // 특정 메서드 호출을 직접 가로채지 않고 관측 가능한 로그를 기준으로 삼아, 테스트가 구현 세부에 지나치게 묶이지 않게 한다.
                beforeEach(async () => {
                    // `resetModules: true` 환경에서는 감시 대상 Logger가 운영 코드의 Logger와 같은 실행 영역에 있어야 한다.
                    // 그래서 같은 모듈 그래프에서 동적으로 가져온다.
                    const { Logger } = await import('@nestjs/common')
                    jest.spyOn(Logger.prototype, 'log').mockImplementation(((message: any) => {
                        if (message === 'completePurchase') {
                            throw new Error('purchase error')
                        }
                    }) as any)
                })

                it('티켓이 판매 상태로 바뀌지 않고 구매 가능 상태로 남는다', async () => {
                    const createDto = buildCreatePurchaseDto(heldTickets)

                    await fix.httpClient
                        .post('/purchases')
                        .headers({ Authorization: `Bearer ${accessToken}` })
                        .body(createDto)
                        .internalServerError()

                    const { TicketsService } = await import('core')
                    const ticketsService = fix.module.get(TicketsService)
                    const tickets = await ticketsService.getMany(pickIds(heldTickets))
                    expect(tickets.every((t) => t.status === TicketStatus.Available)).toBe(true)
                })

                it('결제를 취소하고 구매 기록을 삭제한다', async () => {
                    const { PaymentsService } = await import('infrastructure')
                    const paymentsService = fix.module.get(PaymentsService)

                    // 보상으로 결제가 취소될 뿐 행은 남으므로, 생성된 결제 id를 가로채 상태를 확인한다.
                    let paymentId: string | undefined
                    const createPayment = paymentsService.create.bind(paymentsService)
                    jest.spyOn(paymentsService, 'create').mockImplementationOnce(async (dto) => {
                        const payment = await createPayment(dto)
                        paymentId = payment.id
                        return payment
                    })

                    const createDto = buildCreatePurchaseDto(heldTickets)

                    await fix.httpClient
                        .post('/purchases')
                        .headers({ Authorization: `Bearer ${accessToken}` })
                        .body(createDto)
                        .internalServerError()

                    Require.defined(paymentId)

                    const payments = await getPayments(fix, [paymentId])
                    expect(ensure(payments[0]).status).toBe(PaymentStatus.Cancelled)

                    // 보상이 이 사용자의 유일한 구매 기록을 삭제하므로 본인 구매 기록 조회가 빈 배열이 된다.
                    const { PurchaseRecordsService } = await import('core')
                    const purchaseRecordsService = fix.module.get(PurchaseRecordsService)
                    const records = await purchaseRecordsService.findByUserId(user.id)
                    expect(records).toEqual([])
                })
            })

            describe('티켓이 Sold로 전이된 뒤 이벤트 발행이 실패할 때', () => {
                // 보상 흐름이 실제로 Sold→Available 전이를 수행하는 경로를 검증한다.
                // 위의 시나리오는 `completePurchase` 시작점에서 던지므로 티켓이 Available로 남아 보상은 no-op이지만, 여기는 전이 이후에 던져 보상이 진짜 되돌리기를 하도록 만든다.
                beforeEach(async () => {
                    const { PurchaseEvents } = await import('application')
                    const events = fix.module.get(PurchaseEvents)
                    jest.spyOn(events, 'emitTicketPurchased').mockRejectedValueOnce(
                        new Error('emit failed')
                    )
                })

                it('Sold가 된 티켓을 다시 Available로 되돌린다', async () => {
                    const createDto = buildCreatePurchaseDto(heldTickets)

                    await fix.httpClient
                        .post('/purchases')
                        .headers({ Authorization: `Bearer ${accessToken}` })
                        .body(createDto)
                        .internalServerError()

                    const { TicketsService } = await import('core')
                    const ticketsService = fix.module.get(TicketsService)
                    const tickets = await ticketsService.getMany(pickIds(heldTickets))
                    expect(tickets.every((t) => t.status === TicketStatus.Available)).toBe(true)
                })
            })

            describe('보상 단계가 실패해도', () => {
                // 보상 체인은 best-effort라 한 단계가 실패해도 다음 단계를 계속 시도해야 한다.
                // 이벤트 발행 실패로 보상을 촉발하고 첫 단계인 구매 기록 삭제를 실패시켜,
                // 다음 단계인 결제 취소가 그래도 수행되는지를 본다.
                beforeEach(async () => {
                    const { PurchaseEvents } = await import('application')
                    const { PurchaseRecordsService } = await import('core')
                    const events = fix.module.get(PurchaseEvents)
                    const purchaseRecordsService = fix.module.get(PurchaseRecordsService)
                    jest.spyOn(events, 'emitTicketPurchased').mockRejectedValueOnce(
                        new Error('emit failed')
                    )
                    jest.spyOn(purchaseRecordsService, 'deleteMany').mockRejectedValueOnce(
                        new Error('delete failed')
                    )
                })

                it('나머지 보상 단계는 계속 수행한다', async () => {
                    const { PaymentsService } = await import('infrastructure')
                    const paymentsService = fix.module.get(PaymentsService)

                    // 보상으로 결제가 취소될 뿐 행은 남으므로, 생성된 결제 id를 가로채 상태를 확인한다.
                    let paymentId: string | undefined
                    const createPayment = paymentsService.create.bind(paymentsService)
                    jest.spyOn(paymentsService, 'create').mockImplementationOnce(async (dto) => {
                        const payment = await createPayment(dto)
                        paymentId = payment.id
                        return payment
                    })

                    const createDto = buildCreatePurchaseDto(heldTickets)

                    await fix.httpClient
                        .post('/purchases')
                        .headers({ Authorization: `Bearer ${accessToken}` })
                        .body(createDto)
                        .internalServerError()

                    Require.defined(paymentId)
                    const payments = await getPayments(fix, [paymentId])
                    expect(ensure(payments[0]).status).toBe(PaymentStatus.Cancelled)
                })
            })

            it('이미 판매된 티켓을 다시 구매하려 하면 409를 반환한다', async () => {
                const createDto = buildCreatePurchaseDto(heldTickets)
                await fix.httpClient
                    .post('/purchases')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body(createDto)
                    .created()

                await fix.httpClient
                    .post('/purchases')
                    .headers({ Authorization: `Bearer ${accessToken}` })
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
                // 보상으로 결제가 취소될 뿐 행은 남으므로, 생성된 결제 id를 가로채 상태를 확인한다.
                let paymentId: string | undefined
                const createPayment = paymentsService.create.bind(paymentsService)
                jest.spyOn(paymentsService, 'create').mockImplementationOnce(async (dto) => {
                    const payment = await createPayment(dto)
                    paymentId = payment.id
                    return payment
                })

                const createDto = buildCreatePurchaseDto(heldTickets)

                await fix.httpClient
                    .post('/purchases')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body(createDto)
                    .internalServerError()

                Require.defined(paymentId)
                const payments = await getPayments(fix, [paymentId])
                expect(ensure(payments[0]).status).toBe(PaymentStatus.Cancelled)
            })
        })

        it('티켓을 보유하지 않은 채로 구매하면 400을 반환한다', async () => {
            const { createShowtimeAndTickets } = await import('./purchase.utils')
            const tickets = await createShowtimeAndTickets(fix)

            const createDto = buildCreatePurchaseDto(tickets.slice(0, 1))

            await fix.httpClient
                .post('/purchases')
                .headers({ Authorization: `Bearer ${accessToken}` })
                .body(createDto)
                .badRequest(Errors.Purchase.NotHeld())
        })

        it('다른 사용자가 보유한 티켓을 구매하면 400을 반환한다', async () => {
            const { createShowtimeAndTickets, holdTickets } = await import('./purchase.utils')
            const tickets = await createShowtimeAndTickets(fix)
            // 보유 검증은 결제자 본인의 보유만 인정한다 — 남이 선점한 좌석은 미보유와 동일하게 거절돼야 한다.
            const heldByOther = await holdTickets(fix, oid(0xff), tickets)

            const createDto = buildCreatePurchaseDto(heldByOther)

            await fix.httpClient
                .post('/purchases')
                .headers({ Authorization: `Bearer ${accessToken}` })
                .body(createDto)
                .badRequest(Errors.Purchase.NotHeld())
        })
    })
})
