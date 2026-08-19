import { CacheService, ensure, objectId, pickIds, Require } from '@mannercode/common'
import { oid } from '@mannercode/testing'
import { PurchaseItemType, TicketStatus, type TicketDto, type UserDto } from 'core'
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

            it('판매 뒤 Redis claim 정리가 실패해도 완료 구매를 되돌리지 않는다', async () => {
                const { TicketHoldingService } = await import('core')
                const ticketHoldingService = fix.module.get(TicketHoldingService)
                jest.spyOn(ticketHoldingService, 'releasePurchaseClaims').mockRejectedValueOnce(
                    new Error('redis cleanup failed')
                )

                const createDto = buildCreatePurchaseDto(heldTickets)
                await fix.httpClient
                    .post('/purchases')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body(createDto)
                    .created()

                expect(
                    (await getTickets(fix, pickIds(heldTickets))).every(
                        (ticket) => ticket.status === TicketStatus.Sold
                    )
                ).toBe(true)
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
                // 그러면 `PurchaseService`의 catch 블록이 실행되어 결제와 pending 구매를 보상한다.
                // 티켓은 아직 전이 전이므로 되돌릴 것이 없다.
                // 특정 메서드 호출을 직접 가로채지 않고 관측 가능한 로그를 기준으로 삼아, 테스트가 구현 세부에 지나치게 묶이지 않게 한다.
                beforeEach(async () => {
                    // `resetModules: true` 환경에서는 감시 대상 Logger가 운영 코드의 Logger와 같은 실행 영역에 있어야 한다.
                    // 그래서 같은 모듈 그래프에서 동적으로 가져온다.
                    const { Logger } = await import('@nestjs/common')
                    jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
                        if (message === 'completePurchase') {
                            throw new Error('purchase error')
                        }
                    })
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

                it('결제를 취소하고 구매 기록을 비노출 상태로 확정한다', async () => {
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

                    // cancelled 구매는 감사 추적용 행으로 남지만 정상 구매 목록에는 노출되지 않는다.
                    const { PurchaseRecordsService } = await import('core')
                    const purchaseRecordsService = fix.module.get(PurchaseRecordsService)
                    const records = await purchaseRecordsService.findByUserId(user.id)
                    expect(records).toEqual([])
                })
            })

            describe('티켓이 Sold로 전이된 뒤 구매 완료 커밋이 실패할 때', () => {
                // 보상 흐름이 실제로 Sold→Available 전이를 수행하는 경로를 검증한다.
                // 위의 시나리오는 `completePurchase` 시작점에서 던지므로 티켓이 Available로 남아 보상은 no-op이지만, 여기는 전이 이후에 던져 보상이 진짜 되돌리기를 하도록 만든다.
                beforeEach(async () => {
                    const { PurchaseRecordsService } = await import('core')
                    const purchaseRecordsService = fix.module.get(PurchaseRecordsService)
                    jest.spyOn(purchaseRecordsService, 'markCompleted').mockRejectedValueOnce(
                        new Error('commit failed')
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

            describe('구매 완료 커밋 뒤 이벤트 발행이 실패할 때', () => {
                it('구매는 유지하고 durable event를 후속 재발행한다', async () => {
                    const { PurchaseEvents, PurchaseService } = await import('application')
                    const { PurchaseRecordsService } = await import('core')
                    const events = fix.module.get(PurchaseEvents)
                    const purchaseService = fix.module.get(PurchaseService)
                    const purchaseRecordsService = fix.module.get(PurchaseRecordsService)
                    const emit = jest
                        .spyOn(events, 'emitTicketPurchased')
                        .mockRejectedValueOnce(new Error('publish failed'))

                    const createDto = buildCreatePurchaseDto(heldTickets)
                    const { body: purchaseRecord } = await fix.httpClient
                        .post('/purchases')
                        .headers({ Authorization: `Bearer ${accessToken}` })
                        .body(createDto)
                        .created()

                    expect(
                        (await getTickets(fix, pickIds(heldTickets))).every(
                            (ticket) => ticket.status === TicketStatus.Sold
                        )
                    ).toBe(true)
                    expect(
                        ensure((await getPayments(fix, [purchaseRecord.paymentId]))[0]).status
                    ).toBe(PaymentStatus.Completed)
                    expect(await purchaseRecordsService.findByUserId(user.id)).toEqual([
                        expect.objectContaining({ id: purchaseRecord.id })
                    ])
                    expect(await purchaseRecordsService.findUnpublishedBefore(new Date())).toEqual([
                        expect.objectContaining({ id: purchaseRecord.id })
                    ])

                    await purchaseService.publishPendingPurchaseEvents()

                    expect(emit).toHaveBeenCalledTimes(2)
                    expect(await purchaseRecordsService.findUnpublishedBefore(new Date())).toEqual(
                        []
                    )
                })

                it('완료 커밋이 실패하면 이벤트를 발행하지 않고 구매를 보상한다', async () => {
                    const { PurchaseEvents } = await import('application')
                    const { PurchaseRecordsService } = await import('core')
                    const events = fix.module.get(PurchaseEvents)
                    const purchaseRecordsService = fix.module.get(PurchaseRecordsService)
                    jest.spyOn(purchaseRecordsService, 'markCompleted').mockRejectedValueOnce(
                        new Error('commit failed')
                    )
                    const emit = jest.spyOn(events, 'emitTicketPurchased')

                    const createDto = buildCreatePurchaseDto(heldTickets)
                    await fix.httpClient
                        .post('/purchases')
                        .headers({ Authorization: `Bearer ${accessToken}` })
                        .body(createDto)
                        .internalServerError()

                    expect(emit).not.toHaveBeenCalled()
                    expect(
                        (await getTickets(fix, pickIds(heldTickets))).every(
                            (ticket) => ticket.status === TicketStatus.Available
                        )
                    ).toBe(true)
                })
            })

            describe('보상 단계가 실패해도', () => {
                // 보상 체인은 best-effort라 한 단계가 실패해도 다음 단계를 계속 시도해야 한다.
                // 완료 커밋 실패로 보상을 촉발하고 마지막 상태 전이를 실패시켜 durable pending을 남긴다.
                beforeEach(async () => {
                    const { PurchaseRecordsService } = await import('core')
                    const purchaseRecordsService = fix.module.get(PurchaseRecordsService)
                    jest.spyOn(purchaseRecordsService, 'markCompleted').mockRejectedValueOnce(
                        new Error('commit failed')
                    )
                    jest.spyOn(purchaseRecordsService, 'markCancelled').mockRejectedValueOnce(
                        new Error('state transition failed')
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

                it('남은 구매 상태를 후속 reconciliation으로 정리할 수 있다', async () => {
                    const { PurchaseService } = await import('application')
                    const { PurchaseRecordsService } = await import('core')
                    const purchaseService = fix.module.get(PurchaseService)
                    const purchaseRecordsService = fix.module.get(PurchaseRecordsService)

                    let purchaseRecordId: string | undefined
                    const createRecord = purchaseRecordsService.create.bind(purchaseRecordsService)
                    jest.spyOn(purchaseRecordsService, 'create').mockImplementationOnce(
                        async (...args) => {
                            const record = await createRecord(...args)
                            purchaseRecordId = record.id
                            return record
                        }
                    )

                    const createDto = buildCreatePurchaseDto(heldTickets)
                    await fix.httpClient
                        .post('/purchases')
                        .headers({ Authorization: `Bearer ${accessToken}` })
                        .body(createDto)
                        .internalServerError()

                    Require.defined(purchaseRecordId)
                    expect(await purchaseRecordsService.findByUserId(user.id)).toEqual([])

                    const pendingBefore = await purchaseRecordsService.findPendingBefore(new Date())
                    expect(pendingBefore).toEqual([
                        expect.objectContaining({ id: purchaseRecordId })
                    ])

                    await purchaseService.reconcilePendingPurchases()

                    const pendingAfter = await purchaseRecordsService.findPendingBefore(new Date())
                    expect(pendingAfter).toEqual([])
                })
            })

            it('티켓·결제 보상이 모두 실패해도 durable 상태를 남기고 재시도한다', async () => {
                const { PurchaseService } = await import('application')
                const { PurchaseRecordsService, TicketsService } = await import('core')
                const { PaymentsService } = await import('infrastructure')
                const purchaseService = fix.module.get(PurchaseService)
                const purchaseRecordsService = fix.module.get(PurchaseRecordsService)
                const ticketsService = fix.module.get(TicketsService)
                const paymentsService = fix.module.get(PaymentsService)

                // 트랜잭션 fence 도입 전에 남았거나 이전 버전이 만든
                // Sold+Pending 상태도 durable reconciliation이 복구해야 한다.
                const createDto = buildCreatePurchaseDto(heldTickets)
                const purchaseRecord = await purchaseRecordsService.create(
                    { ...createDto, paymentId: null, userId: user.id },
                    { pending: true }
                )
                const payment = await paymentsService.create({
                    amount: createDto.totalPrice,
                    purchaseRecordId: purchaseRecord.id,
                    userId: user.id
                })
                await purchaseRecordsService.setPaymentId(purchaseRecord.id, payment.id)
                await ticketsService.sellForPurchase(pickIds(heldTickets), purchaseRecord.id)

                jest.spyOn(
                    ticketsService,
                    'releaseOwnedPurchaseForCompensation'
                ).mockRejectedValueOnce(new Error('ticket compensation failed'))
                jest.spyOn(paymentsService, 'cancel').mockRejectedValueOnce(
                    new Error('payment compensation failed')
                )

                const pendingBefore = await purchaseRecordsService.findPendingBefore(new Date())
                expect(pendingBefore).toEqual([expect.objectContaining({ id: purchaseRecord.id })])
                expect(
                    (await getTickets(fix, pickIds(heldTickets))).every(
                        (ticket) => ticket.status === TicketStatus.Sold
                    )
                ).toBe(true)
                expect(ensure((await getPayments(fix, [payment.id]))[0]).status).toBe(
                    PaymentStatus.Completed
                )

                await purchaseService.reconcilePendingPurchases()
                await purchaseService.reconcilePendingPurchases()

                expect(
                    (await getTickets(fix, pickIds(heldTickets))).every(
                        (ticket) => ticket.status === TicketStatus.Available
                    )
                ).toBe(true)
                expect(ensure((await getPayments(fix, [payment.id]))[0]).status).toBe(
                    PaymentStatus.Cancelled
                )
                expect(await purchaseRecordsService.findPendingBefore(new Date())).toEqual([])
            })

            it('active 완료와 reconciliation이 경쟁해도 한쪽 상태만 원자적으로 확정한다', async () => {
                const { PurchaseService } = await import('application')
                const { PurchaseRecordsService, TicketHoldingService } = await import('core')
                const { PaymentsService } = await import('infrastructure')
                const purchaseService = fix.module.get(PurchaseService)
                const purchaseRecordsService = fix.module.get(PurchaseRecordsService)
                const ticketHoldingService = fix.module.get(TicketHoldingService)
                const paymentsService = fix.module.get(PaymentsService)

                let purchaseRecordId: string | undefined
                const createRecord = purchaseRecordsService.create.bind(purchaseRecordsService)
                jest.spyOn(purchaseRecordsService, 'create').mockImplementationOnce(
                    async (...args) => {
                        const record = await createRecord(...args)
                        purchaseRecordId = record.id
                        return record
                    }
                )

                let paymentId: string | undefined
                let paymentCreated!: () => void
                const didCreatePayment = new Promise<void>((resolve) => {
                    paymentCreated = resolve
                })
                let continuePayment!: () => void
                const mayReturnPayment = new Promise<void>((resolve) => {
                    continuePayment = resolve
                })
                const createPayment = paymentsService.create.bind(paymentsService)
                jest.spyOn(paymentsService, 'create').mockImplementationOnce(async (dto) => {
                    const payment = await createPayment(dto)
                    paymentId = payment.id
                    paymentCreated()
                    await mayReturnPayment
                    return payment
                })

                const releaseClaims =
                    ticketHoldingService.releasePurchaseClaims.bind(ticketHoldingService)
                jest.spyOn(ticketHoldingService, 'releasePurchaseClaims').mockImplementationOnce(
                    async () => {
                        // 보상 완료 후에도 live 경로가 Redis confirm을 통과하도록 첫 claim
                        // 해제만 의도적으로 no-op 처리한다. 상태 fence가 없다면 그 뒤 Sold와
                        // Completed가 cancelled payment 위에 기록되는 결정적 interleaving이다.
                    }
                )

                const purchasePromise = fix.httpClient
                    .post('/purchases')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body(buildCreatePurchaseDto(heldTickets))
                    .internalServerError()
                await didCreatePayment
                Require.defined(purchaseRecordId)

                await purchaseService.reconcilePendingPurchases(new Date(Date.now() + 1000))

                continuePayment()
                const purchaseError = await purchasePromise.then(
                    () => undefined,
                    (error: unknown) => error
                )

                Require.defined(paymentId)
                const payment = ensure((await getPayments(fix, [paymentId]))[0])
                const tickets = await getTickets(fix, pickIds(heldTickets))
                const visibleRecords = await purchaseRecordsService.findByUserId(user.id)
                await releaseClaims(purchaseRecordId, heldTickets)

                expect({
                    httpExpectationError: purchaseError,
                    paymentStatus: payment.status,
                    ticketStatuses: tickets.map((ticket) => ticket.status),
                    visibleRecordIds: pickIds(visibleRecords)
                }).toEqual({
                    httpExpectationError: undefined,
                    paymentStatus: PaymentStatus.Cancelled,
                    ticketStatuses: heldTickets.map(() => TicketStatus.Available),
                    visibleRecordIds: []
                })
            })

            it('만료된 completion lease를 보상한 뒤 active worker가 늦게 티켓을 판매하지 않는다', async () => {
                const { PurchaseService } = await import('application')
                const { PurchaseRecordsService, TicketsService } = await import('core')
                const { PaymentsService } = await import('infrastructure')
                const { PurchaseRecordsRepository } =
                    await import('../../services/core/purchase-records/purchase-records.repository')
                const purchaseService = fix.module.get(PurchaseService)
                const purchaseRecordsService = fix.module.get(PurchaseRecordsService)
                const purchaseRecordsRepository = fix.module.get(PurchaseRecordsRepository)
                const ticketsService = fix.module.get(TicketsService)
                const paymentsService = fix.module.get(PaymentsService)

                let purchaseRecordId: string | undefined
                const createRecord = purchaseRecordsService.create.bind(purchaseRecordsService)
                jest.spyOn(purchaseRecordsService, 'create').mockImplementationOnce(
                    async (...args) => {
                        const record = await createRecord(...args)
                        purchaseRecordId = record.id
                        return record
                    }
                )

                let paymentId: string | undefined
                const createPayment = paymentsService.create.bind(paymentsService)
                jest.spyOn(paymentsService, 'create').mockImplementationOnce(async (dto) => {
                    const payment = await createPayment(dto)
                    paymentId = payment.id
                    return payment
                })

                let saleStarted!: () => void
                const didStartSale = new Promise<void>((resolve) => {
                    saleStarted = resolve
                })
                let continueSale!: () => void
                const mayContinueSale = new Promise<void>((resolve) => {
                    continueSale = resolve
                })
                const sellForPurchase = ticketsService.sellForPurchase.bind(ticketsService)
                jest.spyOn(ticketsService, 'sellForPurchase').mockImplementationOnce(
                    async (...args) => {
                        // Redis owner 확인과 Completing CAS는 이미 끝난 시점이다.
                        // Mongo 판매만 멈춰 lease 회수 후의 late effect를 결정적으로 만든다.
                        saleStarted()
                        await mayContinueSale
                        return sellForPurchase(...args)
                    }
                )

                const purchasePromise = fix.httpClient
                    .post('/purchases')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body(buildCreatePurchaseDto(heldTickets))
                    .internalServerError()
                await didStartSale
                Require.defined(purchaseRecordId)

                await purchaseRecordsRepository.model
                    .updateOne(
                        { _id: objectId(purchaseRecordId) },
                        { $set: { completionLeaseUntil: new Date(0) } }
                    )
                    .exec()
                await purchaseService.reconcilePendingPurchases(new Date(Date.now() + 1000))

                continueSale()
                await purchasePromise

                Require.defined(paymentId)
                const payment = ensure((await getPayments(fix, [paymentId]))[0])
                const tickets = await getTickets(fix, pickIds(heldTickets))

                expect({
                    paymentStatus: payment.status,
                    ticketStatuses: tickets.map((ticket) => ticket.status),
                    visibleRecordIds: pickIds(await purchaseRecordsService.findByUserId(user.id))
                }).toEqual({
                    paymentStatus: PaymentStatus.Cancelled,
                    ticketStatuses: heldTickets.map(() => TicketStatus.Available),
                    visibleRecordIds: []
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

            it('durable 구매 기록 생성이 실패하면 외부 효과를 만들지 않는다', async () => {
                const { PurchaseRecordsService } = await import('core')
                const { PaymentsService } = await import('infrastructure')
                const purchaseRecordsService = fix.module.get(PurchaseRecordsService)
                const paymentsService = fix.module.get(PaymentsService)

                jest.spyOn(purchaseRecordsService, 'create').mockImplementationOnce(() => {
                    throw new Error('record creation failed')
                })
                const createPayment = jest.spyOn(paymentsService, 'create')

                const createDto = buildCreatePurchaseDto(heldTickets)

                await fix.httpClient
                    .post('/purchases')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body(createDto)
                    .internalServerError()

                expect(createPayment).not.toHaveBeenCalled()
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

        it('보유 검증 뒤 다른 고객에게 넘어간 티켓을 판매하지 않는다', async () => {
            const { TicketPurchaseService } =
                await import('../../services/application/purchase/internal')
            const { TicketHoldingService } = await import('core')
            const { PaymentsService } = await import('infrastructure')
            const { createShowtimeAndTickets, holdTickets } = await import('./purchase.utils')
            const tickets = await createShowtimeAndTickets(fix)
            const heldByFirst = await holdTickets(fix, user.id, tickets)
            const showtimeId = ensure(heldByFirst[0]).showtimeId
            const secondUserId = oid(0xc2)

            const ticketPurchaseService = fix.module.get(TicketPurchaseService)
            const validatePurchase =
                ticketPurchaseService.validatePurchase.bind(ticketPurchaseService)
            let validationFinished!: () => void
            const validationDidFinish = new Promise<void>((resolve) => {
                validationFinished = resolve
            })
            let continuePurchase!: () => void
            const mayContinue = new Promise<void>((resolve) => {
                continuePurchase = resolve
            })
            jest.spyOn(ticketPurchaseService, 'validatePurchase').mockImplementationOnce(
                async (...args) => {
                    await validatePurchase(...args)
                    validationFinished()
                    await mayContinue
                }
            )

            const paymentsService = fix.module.get(PaymentsService)
            const createPayment = jest.spyOn(paymentsService, 'create')

            const purchasePromise = fix.httpClient
                .post('/purchases')
                .headers({ Authorization: `Bearer ${accessToken}` })
                .body(buildCreatePurchaseDto(heldByFirst))
                .badRequest(Errors.Purchase.NotHeld())

            await validationDidFinish

            const cache = fix.module.get<CacheService>(CacheService.getName('ticket-holding'))
            await Promise.all([
                ...heldByFirst.map((ticket) => cache.delete(`Ticket:{${showtimeId}}:${ticket.id}`)),
                cache.delete(`User:{${showtimeId}}:${user.id}`)
            ])

            const ticketHoldingService = fix.module.get(TicketHoldingService)
            expect(
                await ticketHoldingService.holdTickets({
                    showtimeId,
                    ticketIds: pickIds(heldByFirst),
                    userId: secondUserId
                })
            ).toBe(true)

            continuePurchase()
            await purchasePromise

            // 결제 전에 hold owner를 purchase record로 claim해야 한다. 검증 뒤 다른 고객이
            // 다시 선점했다면 결제를 만들었다가 취소하는 외부 효과조차 없어야 한다.
            expect(createPayment).not.toHaveBeenCalled()
            expect(
                await ticketHoldingService.searchHeldTicketIds(showtimeId, secondUserId)
            ).toEqual(pickIds(heldByFirst))
            expect(
                (await getTickets(fix, pickIds(heldByFirst))).every(
                    (ticket) => ticket.status === TicketStatus.Available
                )
            ).toBe(true)
        })

        it('결제 중 purchase claim이 만료돼 다른 고객이 다시 보유한 티켓을 판매하지 않는다', async () => {
            const { TicketHoldingService } = await import('core')
            const { PaymentsService } = await import('infrastructure')
            const { createShowtimeAndTickets, holdTickets } = await import('./purchase.utils')
            const tickets = await createShowtimeAndTickets(fix)
            const heldByFirst = await holdTickets(fix, user.id, tickets)
            const showtimeId = ensure(heldByFirst[0]).showtimeId
            const secondUserId = oid(0xc3)

            const paymentsService = fix.module.get(PaymentsService)
            const createPayment = paymentsService.create.bind(paymentsService)
            let paymentStarted!: () => void
            const didStartPayment = new Promise<void>((resolve) => {
                paymentStarted = resolve
            })
            let continuePayment!: () => void
            const mayContinuePayment = new Promise<void>((resolve) => {
                continuePayment = resolve
            })
            let paymentId: string | undefined
            jest.spyOn(paymentsService, 'create').mockImplementationOnce(async (dto) => {
                paymentStarted()
                await mayContinuePayment
                const payment = await createPayment(dto)
                paymentId = payment.id
                return payment
            })

            const purchasePromise = fix.httpClient
                .post('/purchases')
                .headers({ Authorization: `Bearer ${accessToken}` })
                .body(buildCreatePurchaseDto(heldByFirst))
                .badRequest(Errors.Purchase.NotHeld())

            // PaymentService 진입은 pending 기록과 purchase owner claim이 모두 끝났다는 뜻이다.
            await didStartPayment
            const cache = fix.module.get<CacheService>(CacheService.getName('ticket-holding'))
            await Promise.all(
                heldByFirst.map((ticket) => cache.delete(`Ticket:{${showtimeId}}:${ticket.id}`))
            )

            const ticketHoldingService = fix.module.get(TicketHoldingService)
            expect(
                await ticketHoldingService.holdTickets({
                    showtimeId,
                    ticketIds: pickIds(heldByFirst),
                    userId: secondUserId
                })
            ).toBe(true)

            continuePayment()
            await purchasePromise

            Require.defined(paymentId)
            expect(ensure((await getPayments(fix, [paymentId]))[0]).status).toBe(
                PaymentStatus.Cancelled
            )
            expect(
                await ticketHoldingService.searchHeldTicketIds(showtimeId, secondUserId)
            ).toEqual(pickIds(heldByFirst))
            expect(
                (await getTickets(fix, pickIds(heldByFirst))).every(
                    (ticket) => ticket.status === TicketStatus.Available
                )
            ).toBe(true)
        })

        it('미구현 food 구매는 DTO 검증에서 명확한 400을 반환한다', async () => {
            await fix.httpClient
                .post('/purchases')
                .headers({ Authorization: `Bearer ${accessToken}` })
                .body({
                    purchaseItems: [{ itemId: oid(0xf0), type: PurchaseItemType.Foods }],
                    totalPrice: 1
                })
                .badRequest(
                    Errors.RequestValidation.Failed([
                        {
                            constraints: {
                                isTicketPurchaseItems:
                                    'Food purchases are not supported; only tickets can be purchased.'
                            },
                            field: 'purchaseItems'
                        }
                    ])
                )
        })
    })

    it('주기 reconciliation은 stale 구매·결제 보상과 durable event 발행을 함께 실행한다', async () => {
        const { PurchaseService } = await import('application')
        const purchaseService = fix.module.get(PurchaseService)
        const reconcile = jest
            .spyOn(purchaseService, 'reconcilePendingPurchases')
            .mockResolvedValueOnce()
        const resolvePayments = jest
            .spyOn(purchaseService, 'reconcileUnresolvedPayments')
            .mockResolvedValueOnce()
        const publish = jest
            .spyOn(purchaseService, 'publishPendingPurchaseEvents')
            .mockResolvedValueOnce()

        const startedAt = Date.now()
        await purchaseService.reconcileStalePurchases()
        const finishedAt = Date.now()

        expect(reconcile).toHaveBeenCalledWith(expect.any(Date))
        const staleBefore = (reconcile.mock.calls[0]?.[0] as Date).getTime()
        expect(staleBefore).toBeGreaterThanOrEqual(startedAt - 10 * 60 * 1000)
        expect(staleBefore).toBeLessThanOrEqual(finishedAt - 10 * 60 * 1000)
        expect(resolvePayments).toHaveBeenCalledWith(reconcile.mock.calls[0]?.[0])
        expect(publish).toHaveBeenCalledWith()
    })

    it('후속 reconciliation 실패는 lease를 풀어 다음 주기에 재시도한다', async () => {
        const { PurchaseService } = await import('application')
        const { PurchaseRecordsService } = await import('core')
        const purchaseService = fix.module.get(PurchaseService)
        const purchaseRecordsService = fix.module.get(PurchaseRecordsService)
        const pending = await purchaseRecordsService.create(
            {
                paymentId: null,
                purchaseItems: [{ itemId: oid(0xfe), type: PurchaseItemType.Tickets }],
                totalPrice: 1,
                userId: user.id
            },
            { pending: true }
        )

        await purchaseService.reconcilePendingPurchases(new Date(Date.now() + 1000))

        expect(await purchaseRecordsService.findPendingBefore(new Date(Date.now() + 1000))).toEqual(
            [expect.objectContaining({ id: pending.id })]
        )
    })

    it('pending 조회 직후 완료된 구매는 보상하지 않는다', async () => {
        const { PurchaseService } = await import('application')
        const { PurchaseRecordsService } = await import('core')
        const { TicketPurchaseService } =
            await import('../../services/application/purchase/internal')
        const purchaseService = fix.module.get(PurchaseService)
        const purchaseRecordsService = fix.module.get(PurchaseRecordsService)
        const ticketPurchaseService = fix.module.get(TicketPurchaseService)
        const completed = await purchaseRecordsService.create({
            paymentId: oid(0xfd),
            purchaseItems: [{ itemId: oid(0xfe), type: PurchaseItemType.Tickets }],
            totalPrice: 1,
            userId: user.id
        })
        jest.spyOn(purchaseRecordsService, 'findPendingBefore').mockResolvedValueOnce([completed])
        const compensate = jest.spyOn(ticketPurchaseService, 'compensatePurchase')

        await purchaseService.reconcilePendingPurchases()

        expect(compensate).not.toHaveBeenCalled()
    })

    it('Cancelled 확정 뒤 생성된 결제의 즉시 취소가 실패해도 주기 작업이 다시 취소한다', async () => {
        const { PurchaseService } = await import('application')
        const { PurchaseRecordsService } = await import('core')
        const { PaymentsService } = await import('infrastructure')
        const { createShowtimeAndTickets, holdTickets } = await import('./purchase.utils')
        const purchaseService = fix.module.get(PurchaseService)
        const purchaseRecordsService = fix.module.get(PurchaseRecordsService)
        const paymentsService = fix.module.get(PaymentsService)
        const heldTickets = await holdTickets(fix, user.id, await createShowtimeAndTickets(fix))

        let purchaseRecordId: string | undefined
        const createRecord = purchaseRecordsService.create.bind(purchaseRecordsService)
        jest.spyOn(purchaseRecordsService, 'create').mockImplementationOnce(async (...args) => {
            const record = await createRecord(...args)
            purchaseRecordId = record.id
            return record
        })

        let paymentCreationStarted!: () => void
        const didStartPaymentCreation = new Promise<void>((resolve) => {
            paymentCreationStarted = resolve
        })
        let continuePaymentCreation!: () => void
        const mayCreatePayment = new Promise<void>((resolve) => {
            continuePaymentCreation = resolve
        })
        let paymentId: string | undefined
        const createPayment = paymentsService.create.bind(paymentsService)
        jest.spyOn(paymentsService, 'create').mockImplementationOnce(async (dto) => {
            paymentCreationStarted()
            await mayCreatePayment
            const payment = await createPayment(dto)
            paymentId = payment.id
            return payment
        })

        const cancelPayment = paymentsService.cancel.bind(paymentsService)
        let failLateCancellation = false
        jest.spyOn(paymentsService, 'cancel').mockImplementation(async (activePaymentId) => {
            if (failLateCancellation) {
                failLateCancellation = false
                throw new Error('late cancellation failed')
            }
            await cancelPayment(activePaymentId)
        })

        const purchasePromise = fix.httpClient
            .post('/purchases')
            .headers({ Authorization: `Bearer ${accessToken}` })
            .body(buildCreatePurchaseDto(heldTickets))
            .internalServerError()
        await didStartPaymentCreation
        Require.defined(purchaseRecordId)

        const markCancelled = jest.spyOn(purchaseRecordsService, 'markCancelled')
        await purchaseService.reconcilePendingPurchases(new Date(Date.now() + 1000))
        expect(markCancelled).toHaveBeenCalledWith(purchaseRecordId, expect.any(String))

        failLateCancellation = true
        continuePaymentCreation()
        await purchasePromise

        Require.defined(paymentId)
        expect(ensure((await getPayments(fix, [paymentId]))[0]).status).toBe(
            PaymentStatus.Completed
        )

        const now = Date.now()
        jest.spyOn(Date, 'now').mockReturnValue(now + 11 * 60 * 1000)
        failLateCancellation = true
        await purchaseService.reconcileStalePurchases()
        expect(ensure((await getPayments(fix, [paymentId]))[0]).status).toBe(
            PaymentStatus.Completed
        )

        await purchaseService.reconcileStalePurchases()

        expect(ensure((await getPayments(fix, [paymentId]))[0]).status).toBe(
            PaymentStatus.Cancelled
        )
    })

    it('미해소 결제의 구매가 완료 상태면 취소하지 않고 resolution만 마친다', async () => {
        const { PurchaseService } = await import('application')
        const { PurchaseRecordsService } = await import('core')
        const { PaymentsService } = await import('infrastructure')
        const purchaseService = fix.module.get(PurchaseService)
        const purchaseRecordsService = fix.module.get(PurchaseRecordsService)
        const paymentsService = fix.module.get(PaymentsService)
        const purchaseRecord = await purchaseRecordsService.create({
            paymentId: null,
            purchaseItems: [{ itemId: oid(0xfb), type: PurchaseItemType.Tickets }],
            totalPrice: 1,
            userId: user.id
        })
        const payment = await paymentsService.create({
            amount: 1,
            purchaseRecordId: purchaseRecord.id,
            userId: user.id
        })
        const cancel = jest.spyOn(paymentsService, 'cancelByPurchaseRecordId')
        const future = new Date(Date.now() + 1000)

        expect(await paymentsService.findUnresolvedBefore(future)).toEqual([
            expect.objectContaining({ id: payment.id })
        ])

        await purchaseService.reconcileUnresolvedPayments(future)

        expect(cancel).not.toHaveBeenCalled()
        expect(await paymentsService.findUnresolvedBefore(future)).toEqual([])
        expect(ensure((await getPayments(fix, [payment.id]))[0]).status).toBe(
            PaymentStatus.Completed
        )
    })

    it('미해소 결제의 구매가 아직 진행 중이면 terminal 상태가 될 때까지 보류한다', async () => {
        const { PurchaseService } = await import('application')
        const { PurchaseRecordsService } = await import('core')
        const { PaymentsService } = await import('infrastructure')
        const purchaseService = fix.module.get(PurchaseService)
        const purchaseRecordsService = fix.module.get(PurchaseRecordsService)
        const paymentsService = fix.module.get(PaymentsService)
        const purchaseRecord = await purchaseRecordsService.create(
            {
                paymentId: null,
                purchaseItems: [{ itemId: oid(0xfa), type: PurchaseItemType.Tickets }],
                totalPrice: 1,
                userId: user.id
            },
            { pending: true }
        )
        const payment = await paymentsService.create({
            amount: 1,
            purchaseRecordId: purchaseRecord.id,
            userId: user.id
        })
        const cancel = jest.spyOn(paymentsService, 'cancelByPurchaseRecordId')
        const future = new Date(Date.now() + 1000)

        await purchaseService.reconcileUnresolvedPayments(future)

        expect(cancel).not.toHaveBeenCalled()
        expect(await paymentsService.findUnresolvedBefore(future)).toEqual([
            expect.objectContaining({ id: payment.id })
        ])
    })

    it('미해소 결제의 구매 기록이 없으면 fail-safe로 취소한다', async () => {
        const { PurchaseService } = await import('application')
        const { PaymentsService } = await import('infrastructure')
        const purchaseService = fix.module.get(PurchaseService)
        const paymentsService = fix.module.get(PaymentsService)
        const payment = await paymentsService.create({
            amount: 1,
            purchaseRecordId: oid(0xf9),
            userId: user.id
        })
        const future = new Date(Date.now() + 1000)

        await purchaseService.reconcileUnresolvedPayments(future)

        expect(ensure((await getPayments(fix, [payment.id]))[0]).status).toBe(
            PaymentStatus.Cancelled
        )
        expect(await paymentsService.findUnresolvedBefore(future)).toEqual([])
    })

    it('marker와 purchaseRecordId가 없는 legacy 결제도 구매 결과에 맞게 백필·정리한다', async () => {
        const { PurchaseService } = await import('application')
        const { PurchaseRecordsService, PurchaseRecordStatus } = await import('core')
        const { PaymentsRepository } =
            await import('../../services/infrastructure/payments/payments.repository')
        const { PurchaseRecordsRepository } =
            await import('../../services/core/purchase-records/purchase-records.repository')
        const purchaseService = fix.module.get(PurchaseService)
        const purchaseRecordsService = fix.module.get(PurchaseRecordsService)
        const paymentsRepository = fix.module.get(PaymentsRepository)
        const purchaseRecordsRepository = fix.module.get(PurchaseRecordsRepository)
        const staleAt = new Date(Date.now() - 11 * 60 * 1000)
        const insertLegacyPayment = async () =>
            paymentsRepository.model.collection.insertOne({
                amount: 1,
                createdAt: staleAt,
                deletedAt: null,
                status: PaymentStatus.Completed,
                updatedAt: staleAt,
                userId: user.id
            })

        const successfulPayment = await insertLegacyPayment()
        const { insertedId: successfulRecordId } =
            await purchaseRecordsRepository.model.collection.insertOne({
                createdAt: staleAt,
                deletedAt: null,
                paymentId: String(successfulPayment.insertedId),
                purchaseEventStatus: 'published',
                purchaseItems: [],
                totalPrice: 1,
                updatedAt: staleAt,
                userId: user.id
                // status 필드가 없는 upgrade 전 성공 기록이다.
            })

        const cancelledPayment = await insertLegacyPayment()
        await purchaseRecordsRepository.model.collection.insertOne({
            createdAt: staleAt,
            deletedAt: null,
            paymentId: String(cancelledPayment.insertedId),
            purchaseEventStatus: 'published',
            purchaseItems: [],
            status: PurchaseRecordStatus.Cancelled,
            totalPrice: 1,
            updatedAt: staleAt,
            userId: user.id
        })
        const orphanPayment = await insertLegacyPayment()
        const pendingPayment = await insertLegacyPayment()
        const { insertedId: pendingRecordId } =
            await purchaseRecordsRepository.model.collection.insertOne({
                createdAt: staleAt,
                deletedAt: null,
                paymentId: String(pendingPayment.insertedId),
                purchaseEventStatus: 'pending',
                purchaseItems: [],
                status: PurchaseRecordStatus.Pending,
                totalPrice: 1,
                updatedAt: staleAt,
                userId: user.id
            })

        expect(await purchaseRecordsService.findStatusById(String(successfulRecordId))).toBe(
            PurchaseRecordStatus.Completed
        )

        await purchaseService.reconcileUnresolvedPayments(new Date())

        const [successful, cancelled, orphan, pending] = await Promise.all(
            [successfulPayment, cancelledPayment, orphanPayment, pendingPayment].map(
                ({ insertedId }) => paymentsRepository.model.collection.findOne({ _id: insertedId })
            )
        )
        expect(successful).toEqual(
            expect.objectContaining({
                purchaseRecordId: String(successfulRecordId),
                requiresPurchaseResolution: false,
                status: PaymentStatus.Completed
            })
        )
        expect(cancelled).toEqual(
            expect.objectContaining({
                requiresPurchaseResolution: false,
                status: PaymentStatus.Cancelled
            })
        )
        expect(orphan).toEqual(
            expect.objectContaining({
                requiresPurchaseResolution: false,
                status: PaymentStatus.Cancelled
            })
        )
        expect(pending).toEqual(
            expect.objectContaining({
                purchaseRecordId: String(pendingRecordId),
                requiresPurchaseResolution: true,
                status: PaymentStatus.Completed
            })
        )
    })

    it('이전 보상이 티켓을 풀고 실패한 뒤 재판매되어도 새 owner를 유지하며 취소로 수렴한다', async () => {
        const { PurchaseService } = await import('application')
        const { PurchaseRecordsService, PurchaseRecordStatus, TicketsService } =
            await import('core')
        const { PaymentsService } = await import('infrastructure')
        const { createShowtimeAndTickets, holdTickets } = await import('./purchase.utils')
        const { PurchaseRecordsRepository } =
            await import('../../services/core/purchase-records/purchase-records.repository')
        const { TicketsRepository } = await import('../../services/core/tickets/tickets.repository')
        const purchaseService = fix.module.get(PurchaseService)
        const purchaseRecordsService = fix.module.get(PurchaseRecordsService)
        const purchaseRecordsRepository = fix.module.get(PurchaseRecordsRepository)
        const ticketsService = fix.module.get(TicketsService)
        const ticketsRepository = fix.module.get(TicketsRepository)
        const paymentsService = fix.module.get(PaymentsService)
        const heldTickets = await holdTickets(fix, user.id, await createShowtimeAndTickets(fix))
        const createDto = buildCreatePurchaseDto(heldTickets)
        const oldPurchase = await purchaseRecordsService.create(
            { ...createDto, paymentId: null, userId: user.id },
            { pending: true }
        )
        const oldPayment = await paymentsService.create({
            amount: createDto.totalPrice,
            purchaseRecordId: oldPurchase.id,
            userId: user.id
        })
        await purchaseRecordsService.setPaymentId(oldPurchase.id, oldPayment.id)
        await ticketsService.sellForPurchase(pickIds(heldTickets), oldPurchase.id)
        jest.spyOn(paymentsService, 'cancel').mockRejectedValueOnce(
            new Error('payment compensation failed after ticket release')
        )

        await purchaseService.reconcilePendingPurchases(new Date(Date.now() + 1000))
        expect(
            (await getTickets(fix, pickIds(heldTickets))).every(
                (ticket) => ticket.status === TicketStatus.Available
            )
        ).toBe(true)

        const newPurchase = await purchaseRecordsService.create({
            ...createDto,
            paymentId: oid(0xf8),
            userId: user.id
        })
        await ticketsService.sellForPurchase(pickIds(heldTickets), newPurchase.id)

        await purchaseService.reconcilePendingPurchases(new Date(Date.now() + 1000))

        const oldRecord = await purchaseRecordsRepository.model.findById(oldPurchase.id).lean()
        const tickets = await ticketsRepository.model
            .find({ _id: { $in: pickIds(heldTickets).map(objectId) } })
            .lean()
        expect(oldRecord?.status).toBe(PurchaseRecordStatus.Cancelled)
        expect(
            tickets.every(
                (ticket) =>
                    ticket.status === TicketStatus.Sold &&
                    ticket.purchaseRecordId === newPurchase.id
            )
        ).toBe(true)
    })

    it('두 outbox publisher가 경쟁해도 publication lease 소유자만 한 번 emit한다', async () => {
        const { PurchaseEvents, PurchaseService } = await import('application')
        const { PurchaseRecordsService } = await import('core')
        const events = fix.module.get(PurchaseEvents)
        const purchaseService = fix.module.get(PurchaseService)
        const purchaseRecordsService = fix.module.get(PurchaseRecordsService)
        const pending = await purchaseRecordsService.create(
            {
                paymentId: null,
                purchaseItems: [{ itemId: oid(0xf7), type: PurchaseItemType.Tickets }],
                totalPrice: 1,
                userId: user.id
            },
            { pending: true }
        )
        const completionId = 'outbox-completion'
        await purchaseRecordsService.claimForCompletion(
            pending.id,
            completionId,
            new Date(Date.now() + 60_000)
        )
        await purchaseRecordsService.markCompleted(pending.id, completionId)
        const before = new Date(Date.now() + 1000)
        let firstEmitStarted!: () => void
        const didStartFirstEmit = new Promise<void>((resolve) => {
            firstEmitStarted = resolve
        })
        let finishFirstEmit!: () => void
        const mayFinishFirstEmit = new Promise<void>((resolve) => {
            finishFirstEmit = resolve
        })
        const emit = jest.spyOn(events, 'emitTicketPurchased').mockImplementationOnce(async () => {
            firstEmitStarted()
            await mayFinishFirstEmit
        })
        // 두 replica가 lease 획득 전 같은 stale outbox 목록을 읽은 상황을 고정한다.
        // 목록 조회만으로 중복을 막는 것이 아니라 저장소의 publication CAS가 loser를
        // 실제로 거절해야 한다.
        jest.spyOn(purchaseRecordsService, 'findUnpublishedBefore').mockResolvedValue([pending])

        const firstPublisher = purchaseService.publishPendingPurchaseEvents(before)
        await didStartFirstEmit
        let callsDuringOverlap = 0
        try {
            await purchaseService.publishPendingPurchaseEvents(before)
            callsDuringOverlap = emit.mock.calls.length
        } finally {
            finishFirstEmit()
            await firstPublisher
        }

        expect(callsDuringOverlap).toBe(1)
        expect(emit).toHaveBeenCalledTimes(1)
    })

    it('emit 성공 후 outbox ack가 실패하면 안정 key로 at-least-once 재발행한다', async () => {
        const { PurchaseEvents, PurchaseService } = await import('application')
        const { PurchaseRecordsService } = await import('core')
        const events = fix.module.get(PurchaseEvents)
        const purchaseService = fix.module.get(PurchaseService)
        const purchaseRecordsService = fix.module.get(PurchaseRecordsService)
        const pending = await purchaseRecordsService.create(
            {
                paymentId: null,
                purchaseItems: [{ itemId: oid(0xf6), type: PurchaseItemType.Tickets }],
                totalPrice: 1,
                userId: user.id
            },
            { pending: true }
        )
        const completionId = 'outbox-ack-failure'
        await purchaseRecordsService.claimForCompletion(
            pending.id,
            completionId,
            new Date(Date.now() + 60_000)
        )
        await purchaseRecordsService.markCompleted(pending.id, completionId)
        const emit = jest.spyOn(events, 'emitTicketPurchased').mockResolvedValue()
        jest.spyOn(purchaseRecordsService, 'markEventPublished').mockResolvedValueOnce(false)
        const before = new Date(Date.now() + 1000)

        await purchaseService.publishPendingPurchaseEvents(before)
        await purchaseService.publishPendingPurchaseEvents(before)

        expect(emit).toHaveBeenCalledTimes(2)
        expect(emit.mock.calls.map(([event]) => event.purchaseRecordId)).toEqual([
            pending.id,
            pending.id
        ])
        expect(await purchaseRecordsService.findUnpublishedBefore(before)).toEqual([])
    })

    it('outbox publish와 publication claim 해제가 모두 실패해도 완료 구매를 되돌리지 않는다', async () => {
        const { PurchaseEvents, PurchaseService } = await import('application')
        const { PurchaseRecordsService } = await import('core')
        const events = fix.module.get(PurchaseEvents)
        const purchaseService = fix.module.get(PurchaseService)
        const purchaseRecordsService = fix.module.get(PurchaseRecordsService)
        const pending = await purchaseRecordsService.create(
            {
                paymentId: null,
                purchaseItems: [{ itemId: oid(0xf5), type: PurchaseItemType.Tickets }],
                totalPrice: 1,
                userId: user.id
            },
            { pending: true }
        )
        const completionId = 'outbox-release-failure'
        await purchaseRecordsService.claimForCompletion(
            pending.id,
            completionId,
            new Date(Date.now() + 60_000)
        )
        await purchaseRecordsService.markCompleted(pending.id, completionId)
        jest.spyOn(events, 'emitTicketPurchased').mockRejectedValueOnce(
            new Error('broker unavailable')
        )
        const release = jest
            .spyOn(purchaseRecordsService, 'releaseEventPublicationClaim')
            .mockRejectedValueOnce(new Error('claim release unavailable'))

        await expect(
            purchaseService.publishPendingPurchaseEvents(new Date(Date.now() + 1000))
        ).resolves.toBeUndefined()

        expect(release).toHaveBeenCalledTimes(1)
        expect(await purchaseRecordsService.findByUserId(user.id)).toEqual([
            expect.objectContaining({ id: pending.id })
        ])
    })

    it('보상과 lease 해제가 함께 실패해도 주기 reconciliation 호출자는 실패하지 않는다', async () => {
        const { PurchaseService } = await import('application')
        const { PurchaseRecordsService } = await import('core')
        const { TicketPurchaseService } =
            await import('../../services/application/purchase/internal')
        const purchaseService = fix.module.get(PurchaseService)
        const purchaseRecordsService = fix.module.get(PurchaseRecordsService)
        const ticketPurchaseService = fix.module.get(TicketPurchaseService)
        await purchaseRecordsService.create(
            {
                paymentId: null,
                purchaseItems: [{ itemId: oid(0xfc), type: PurchaseItemType.Tickets }],
                totalPrice: 1,
                userId: user.id
            },
            { pending: true }
        )
        jest.spyOn(ticketPurchaseService, 'compensatePurchase').mockRejectedValueOnce(
            new Error('ticket compensation failed')
        )
        const release = jest
            .spyOn(purchaseRecordsService, 'releaseReconciliationClaim')
            .mockRejectedValueOnce(new Error('lease release failed'))

        await expect(
            purchaseService.reconcilePendingPurchases(new Date(Date.now() + 1000))
        ).resolves.toBeUndefined()
        expect(release).toHaveBeenCalledTimes(1)
    })
})
