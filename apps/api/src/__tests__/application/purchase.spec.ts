import { CacheService, DateUtil, ensure, pickIds, Require } from '@mannercode/common'
import { HttpTestClient, oid } from '@mannercode/testing'
import { randomUUID } from 'node:crypto'
import { PurchaseEvents } from '#application'
import {
    PurchaseRecordStatus,
    TicketStatus,
    ShowtimesService,
    type PurchaseRecordDto,
    PurchaseRecordsService,
    type TicketDto,
    type UserDto,
    TicketHoldingService,
    TicketsService,
    PurchaseRecordSchema
} from '#core'
import { PaymentStatus, PaymentsService } from '#infrastructure'
import {
    createAndLoginUser,
    Errors,
    getPayments,
    getTickets,
    overrideConfigGetter,
    type AppTestContext,
    createAppTestContext
} from '../helpers/index.js'
import { buildCreatePurchaseDto, createShowtimeAndTickets, holdTickets } from './purchase.utils.js'
import { TicketPurchaseService } from '../../services/application/purchase/internal/index.js'
import { AppConfigService } from '#config'
import { BadRequestException, HttpException } from '@nestjs/common'
import { PaymentsRepository } from '../../services/infrastructure/payments/payments.repository.js'
import {
    PurchaseEventWorkflowClient,
    PurchaseWorkflowClient
} from '../../services/application/purchase/worker/index.js'
import { PurchaseRecordsRepository } from '../../services/core/purchase-records/purchase-records.repository.js'

describe('PurchaseService', () => {
    let fix: AppTestContext
    let teardown: AppTestContext['teardown'] | undefined
    let user: UserDto
    let accessToken: string

    beforeEach(async () => {
        teardown = undefined

        fix = await createAppTestContext({ enableRestate: true })
        teardown = fix.teardown
        ;({ user, accessToken } = await createAndLoginUser(fix))
    })
    afterEach(() => teardown?.())

    describe('POST /purchases', () => {
        describe('고객이 티켓을 보유하고 있을 때', () => {
            let heldTickets: TicketDto[]

            beforeEach(async () => {
                const tickets = await createShowtimeAndTickets(fix)
                heldTickets = await holdTickets(fix, user.id, tickets)
            })

            it('Idempotency-Key가 없으면 400을 반환한다', async () => {
                await fix.httpClient
                    .post('/purchases')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body(buildCreatePurchaseDto(heldTickets))
                    .badRequest({ expected: Errors.Idempotency.KeyRequired() })
            })

            it('문자열로 전달한 결제 금액은 400을 반환한다', async () => {
                const createDto = buildCreatePurchaseDto(heldTickets)
                await fix.httpClient
                    .post('/purchases')
                    .headers({
                        Authorization: `Bearer ${accessToken}`,
                        'Idempotency-Key': randomUUID()
                    })
                    .body({ ...createDto, totalPrice: String(createDto.totalPrice) })
                    .badRequest()
            })

            it('Idempotency-Key 형식이 잘못되면 400을 반환한다', async () => {
                await fix.httpClient
                    .post('/purchases')
                    .headers({ Authorization: `Bearer ${accessToken}`, 'Idempotency-Key': 'short' })
                    .body(buildCreatePurchaseDto(heldTickets))
                    .badRequest({ expected: Errors.Idempotency.KeyInvalid() })
            })

            it('같은 키와 같은 요청은 결제를 다시 만들지 않고 최초 구매 응답을 반환한다', async () => {
                const createPayment = vi.spyOn(fix.module.get(PaymentsService), 'create')
                const client = fix.module.get(PurchaseWorkflowClient)
                const submit = client.submit.bind(client)
                vi.spyOn(client, 'submit').mockImplementationOnce(async (...args) => {
                    const accepted = await submit(...args)
                    await client.waitForCompletion(accepted)
                    // 최초 접수 응답 유실로 SDK가 같은 요청을 다시 제출한 상황이다.
                    return submit(...args)
                })
                const createDto = buildCreatePurchaseDto(heldTickets)
                const idempotencyKey = randomUUID()

                const first = await fix.httpClient
                    .post('/purchases')
                    .headers({
                        Authorization: `Bearer ${accessToken}`,
                        'Idempotency-Key': idempotencyKey
                    })
                    .body(createDto)
                    .created({ schema: PurchaseRecordSchema })
                const replay = await fix.httpClient
                    .post('/purchases')
                    .headers({
                        Authorization: `Bearer ${accessToken}`,
                        'Idempotency-Key': idempotencyKey
                    })
                    .body(createDto)
                    .created({ schema: PurchaseRecordSchema })

                expect(replay.body).toEqual(first.body)
                expect(createPayment).toHaveBeenCalledTimes(1)
            })

            it('DB 예약 전 같은 키를 다시 제출해도 workflow를 중복 실행하지 않는다', async () => {
                const records = fix.module.get(PurchaseRecordsService)
                const createRecord = records.create.bind(records)
                const entered = Promise.withResolvers<void>()
                const release = Promise.withResolvers<void>()
                const create = vi
                    .spyOn(records, 'create')
                    .mockImplementationOnce(async (...args) => {
                        entered.resolve()
                        await release.promise
                        return createRecord(...args)
                    })
                const createPayment = vi.spyOn(fix.module.get(PaymentsService), 'create')
                const createDto = buildCreatePurchaseDto(heldTickets)
                const idempotencyKey = randomUUID()
                const send = () =>
                    new HttpTestClient(fix.httpClient.serverUrl)
                        .post('/purchases')
                        .headers({
                            Authorization: `Bearer ${accessToken}`,
                            'Idempotency-Key': idempotencyKey
                        })
                        .body(createDto)
                const first = send().created({ schema: PurchaseRecordSchema })
                await entered.promise
                try {
                    await send().conflict({ expected: Errors.Idempotency.RequestInProgress() })
                } finally {
                    release.resolve()
                }
                const completed = await first
                expect((await send().created({ schema: PurchaseRecordSchema })).body).toEqual(
                    completed.body
                )
                expect(create).toHaveBeenCalledTimes(1)
                expect(createPayment).toHaveBeenCalledTimes(1)
            })

            it('최초 조회 뒤 같은 키의 구매가 완료되어도 판매 오류 대신 최초 결과를 재생한다', async () => {
                const tickets = fix.module.get(TicketsService)
                const getMany = tickets.getMany.bind(tickets)
                const createPayment = vi.spyOn(fix.module.get(PaymentsService), 'create')
                let reached!: () => void
                const didReach = new Promise<void>((resolve) => {
                    reached = resolve
                })
                let release!: () => void
                const mayRead = new Promise<void>((resolve) => {
                    release = resolve
                })
                vi.spyOn(tickets, 'getMany').mockImplementationOnce(async (...args) => {
                    reached()
                    await mayRead
                    return getMany(...args)
                })
                const createDto = buildCreatePurchaseDto(heldTickets)
                const key = randomUUID()
                const send = () =>
                    new HttpTestClient(fix.httpClient.serverUrl)
                        .post('/purchases')
                        .headers({ Authorization: `Bearer ${accessToken}`, 'Idempotency-Key': key })
                        .body(createDto)
                        .created({ schema: PurchaseRecordSchema })
                const delayed = send()
                await didReach
                let completed: Awaited<ReturnType<typeof send>>
                try {
                    completed = await send()
                } finally {
                    release()
                }
                expect((await delayed).body).toEqual(completed.body)
                expect(createPayment).toHaveBeenCalledTimes(1)
            })

            it('서로 다른 티켓 묶음이 같은 키로 경합해도 한 요청만 실행한다', async () => {
                const purchaseRecordsService = fix.module.get(PurchaseRecordsService)
                const createRecord = purchaseRecordsService.create.bind(purchaseRecordsService)
                let createCallCount = 0
                let firstCreateEntered!: () => void
                const didEnterFirstCreate = new Promise<void>((resolve) => {
                    firstCreateEntered = resolve
                })
                let secondCreateEntered!: () => void
                const didEnterSecondCreate = new Promise<void>((resolve) => {
                    secondCreateEntered = resolve
                })
                let firstCreateSaved!: () => void
                const didSaveFirstCreate = new Promise<void>((resolve) => {
                    firstCreateSaved = resolve
                })
                vi.spyOn(purchaseRecordsService, 'create').mockImplementation(async (...args) => {
                    createCallCount += 1
                    if (createCallCount === 1) {
                        firstCreateEntered()
                        await didEnterSecondCreate
                        const record = await createRecord(...args)
                        firstCreateSaved()
                        return record
                    }

                    secondCreateEntered()
                    await didSaveFirstCreate
                    return createRecord(...args)
                })

                const idempotencyKey = randomUUID()
                const firstDto = buildCreatePurchaseDto([ensure(heldTickets[0])])
                const secondDto = buildCreatePurchaseDto([ensure(heldTickets[1])])
                const first = new HttpTestClient(fix.httpClient.serverUrl)
                    .post('/purchases')
                    .headers({
                        Authorization: `Bearer ${accessToken}`,
                        'Idempotency-Key': idempotencyKey
                    })
                    .body(firstDto)
                    .created({ schema: PurchaseRecordSchema })
                await didEnterFirstCreate
                const second = new HttpTestClient(fix.httpClient.serverUrl)
                    .post('/purchases')
                    .headers({
                        Authorization: `Bearer ${accessToken}`,
                        'Idempotency-Key': idempotencyKey
                    })
                    .body(secondDto)
                    .conflict({ expected: Errors.Idempotency.KeyReused() })

                await Promise.all([first, second])
                expect(createCallCount).toBe(2)
            })

            it('같은 키를 다른 요청 본문에 재사용하면 409를 반환한다', async () => {
                const createDto = buildCreatePurchaseDto(heldTickets)
                const idempotencyKey = randomUUID()

                await fix.httpClient
                    .post('/purchases')
                    .headers({
                        Authorization: `Bearer ${accessToken}`,
                        'Idempotency-Key': idempotencyKey
                    })
                    .body(createDto)
                    .created({ schema: PurchaseRecordSchema })

                await fix.httpClient
                    .post('/purchases')
                    .headers({
                        Authorization: `Bearer ${accessToken}`,
                        'Idempotency-Key': idempotencyKey
                    })
                    .body({ ...createDto, totalPrice: createDto.totalPrice + 1 })
                    .conflict({ expected: Errors.Idempotency.KeyReused() })
            })

            it('같은 키의 최초 요청을 처리 중이면 409를 반환한다', async () => {
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
                vi.spyOn(paymentsService, 'create').mockImplementationOnce(async (dto) => {
                    paymentStarted()
                    await mayContinuePayment
                    return createPayment(dto)
                })

                const idempotencyKey = randomUUID()
                const createDto = buildCreatePurchaseDto(heldTickets)
                const firstClient = new HttpTestClient(fix.httpClient.serverUrl)
                const first = firstClient
                    .post('/purchases')
                    .headers({
                        Authorization: `Bearer ${accessToken}`,
                        'Idempotency-Key': idempotencyKey
                    })
                    .body(createDto)
                    .created({ schema: PurchaseRecordSchema })

                await didStartPayment
                try {
                    await fix.httpClient
                        .post('/purchases')
                        .headers({
                            Authorization: `Bearer ${accessToken}`,
                            'Idempotency-Key': idempotencyKey
                        })
                        .body(createDto)
                        .conflict({ expected: Errors.Idempotency.RequestInProgress() })
                } finally {
                    continuePayment()
                }
                await first
            })

            it('실행 전 검증 실패는 키를 소비하지 않는다', async () => {
                const idempotencyKey = randomUUID()
                const createDto = buildCreatePurchaseDto(heldTickets)

                await fix.httpClient
                    .post('/purchases')
                    .headers({
                        Authorization: `Bearer ${accessToken}`,
                        'Idempotency-Key': idempotencyKey
                    })
                    .body({ ...createDto, totalPrice: createDto.totalPrice + 1 })
                    .badRequest({
                        expected: Errors.Purchase.TotalPriceMismatch(
                            expect.any(Number),
                            createDto.totalPrice + 1
                        )
                    })

                await fix.httpClient
                    .post('/purchases')
                    .headers({
                        Authorization: `Bearer ${accessToken}`,
                        'Idempotency-Key': idempotencyKey
                    })
                    .body(createDto)
                    .created({ schema: PurchaseRecordSchema })
            })

            it('구매를 반환하고 결제 기록과 티켓 판매 상태를 저장한다', async () => {
                const createDto = buildCreatePurchaseDto(heldTickets)

                const { body: purchaseRecord } = await fix.httpClient
                    .post('/purchases')
                    .headers({ 'Idempotency-Key': randomUUID() })
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body(createDto)
                    .created({
                        schema: PurchaseRecordSchema,
                        expected: {
                            ...createDto,
                            userId: user.id,
                            createdAt: expect.any(Temporal.Instant),
                            id: expect.any(String),
                            paymentId: expect.any(String),
                            updatedAt: expect.any(Temporal.Instant)
                        }
                    })
                const payments = await getPayments(fix, [ensure(purchaseRecord.paymentId)])

                expect(ensure(payments[0]).amount).toEqual(purchaseRecord.totalPrice)

                const soldTickets = await getTickets(fix, pickIds(heldTickets))

                expect(soldTickets.every((t) => t.status === TicketStatus.Sold)).toBe(true)
            })

            it('판매 뒤 Redis claim 정리가 실패해도 완료 구매를 되돌리지 않는다', async () => {
                const ticketHoldingService = fix.module.get(TicketHoldingService)
                vi.spyOn(ticketHoldingService, 'releasePurchaseClaims').mockRejectedValueOnce(
                    new Error('redis cleanup failed')
                )

                const createDto = buildCreatePurchaseDto(heldTickets)
                await fix.httpClient
                    .post('/purchases')
                    .headers({ 'Idempotency-Key': randomUUID() })
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body(createDto)
                    .created({ schema: PurchaseRecordSchema })

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
                    .headers({ 'Idempotency-Key': randomUUID() })
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body(createDto)
                    .badRequest({ expected: Errors.Purchase.LimitExceeded(expect.any(Number)) })
            })

            it('다른 상영의 티켓을 섞으면 구매를 시작하지 않고 선점을 유지한다', async () => {
                const otherTickets = await createShowtimeAndTickets(fix)
                const otherHeldTickets = await holdTickets(fix, user.id, otherTickets)
                const selected = [ensure(heldTickets[0]), ensure(otherHeldTickets[0])]
                const idempotencyKey = randomUUID()

                await fix.httpClient
                    .post('/purchases')
                    .headers({
                        Authorization: `Bearer ${accessToken}`,
                        'Idempotency-Key': idempotencyKey
                    })
                    .body(buildCreatePurchaseDto(selected))
                    .badRequest({ expected: Errors.Purchase.MultipleShowtimes() })

                const holding = fix.module.get(TicketHoldingService)
                for (const ticket of selected) {
                    expect(await holding.searchHeldTicketIds(ticket.showtimeId, user.id)).toContain(
                        ticket.id
                    )
                }
                expect(
                    await fix.module
                        .get(PurchaseRecordsService)
                        .findIdempotencyOperation({ userId: user.id, idempotencyKey })
                ).toBeUndefined()
            })

            it('구매 가능 시간이 종료되면 400을 반환한다', async () => {
                const config = fix.module.get(AppConfigService)
                const [showtime] = await fix.module
                    .get(ShowtimesService)
                    .getMany([ensure(heldTickets[0]).showtimeId])
                const startTime = ensure(showtime).startTime
                await overrideConfigGetter(fix.module, 'ticket', {
                    purchaseCutoffMinutes: config.ticket.purchaseCutoffMinutes + 2
                })

                const createDto = buildCreatePurchaseDto(heldTickets)

                await fix.httpClient
                    .post('/purchases')
                    .headers({ 'Idempotency-Key': randomUUID() })
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body(createDto)
                    .badRequest({
                        expected: Errors.Purchase.WindowClosed(
                            config.ticket.purchaseCutoffMinutes,
                            DateUtil.add({
                                base: startTime,
                                minutes: -config.ticket.purchaseCutoffMinutes
                            }).toString(),
                            startTime.toString()
                        )
                    })
            })

            it('금액이 서버 계산과 다르면 400을 반환한다', async () => {
                const createDto = buildCreatePurchaseDto(heldTickets, { totalPrice: 1 })

                await fix.httpClient
                    .post('/purchases')
                    .headers({ 'Idempotency-Key': randomUUID() })
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body(createDto)
                    .badRequest({
                        expected: Errors.Purchase.TotalPriceMismatch(expect.any(Number), 1)
                    })
            })

            it.each([
                { label: '커밋 응답 유실', failure: new Error('commit response lost') },
                {
                    label: '늦은 시도의 업무상 거절',
                    failure: new BadRequestException(Errors.Purchase.NotHeld())
                }
            ])(
                '선점·결제 재시도와 $label 뒤에도 최초 완료 결과를 유지한다',
                async ({ failure }) => {
                    const holding = fix.module.get(TicketHoldingService)
                    const claim = holding.claimTicketsForPurchase.bind(holding)
                    vi.spyOn(holding, 'claimTicketsForPurchase').mockImplementationOnce(
                        async (input) => {
                            expect(await claim(input)).toBe(true)
                            throw new HttpException('claim response lost', 503)
                        }
                    )
                    const payments = fix.module.get(PaymentsService)
                    const createPayment = payments.create.bind(payments)
                    vi.spyOn(payments, 'create').mockImplementationOnce(async (input) => {
                        await createPayment(input)
                        throw new Error('payment response lost')
                    })
                    const ticketPurchase = fix.module.get(TicketPurchaseService)
                    const complete = ticketPurchase.completePurchase.bind(ticketPurchase)
                    vi.spyOn(ticketPurchase, 'completePurchase').mockImplementationOnce(
                        async (...args) => {
                            await complete(...args)
                            throw failure
                        }
                    )
                    const idempotencyKey = randomUUID()
                    const createDto = buildCreatePurchaseDto(heldTickets)
                    const send = () =>
                        new HttpTestClient(fix.httpClient.serverUrl)
                            .post('/purchases')
                            .headers({
                                Authorization: `Bearer ${accessToken}`,
                                'Idempotency-Key': idempotencyKey
                            })
                            .body(createDto)
                            .created({ schema: PurchaseRecordSchema })
                    const { body: completed }: { body: PurchaseRecordDto } = await send()

                    expect((await send()).body).toEqual(completed)
                    expect(
                        await fix.module
                            .get(PaymentsRepository)
                            .collection.countDocuments({ purchaseRecordId: completed.id })
                    ).toBe(1)
                    expect(await getTickets(fix, pickIds(heldTickets))).toEqual(
                        heldTickets.map((ticket) =>
                            expect.objectContaining({ id: ticket.id, status: TicketStatus.Sold })
                        )
                    )
                    expect(
                        (await fix.module.get(PurchaseRecordsRepository).get({ id: completed.id }))
                            .status
                    ).toBe(PurchaseRecordStatus.Completed)
                }
            )

            it('완료 transaction의 일시 실패는 판매를 rollback하고 같은 결제로 재시도한다', async () => {
                const records = fix.module.get(PurchaseRecordsService)
                const complete = records.markCompleted.bind(records)
                const retryEntered = Promise.withResolvers<void>()
                const release = Promise.withResolvers<void>()
                vi.spyOn(records, 'markCompleted')
                    .mockRejectedValueOnce(new Error('transaction failed'))
                    .mockImplementationOnce(async (...args) => {
                        retryEntered.resolve()
                        await release.promise
                        return complete(...args)
                    })
                const emit = vi.spyOn(fix.module.get(PurchaseEvents), 'emitTicketPurchased')
                const payment = vi.spyOn(fix.module.get(PaymentsService), 'create')
                const request = fix.httpClient
                    .post('/purchases')
                    .headers({
                        Authorization: `Bearer ${accessToken}`,
                        'Idempotency-Key': randomUUID()
                    })
                    .body(buildCreatePurchaseDto(heldTickets))
                    .created({ schema: PurchaseRecordSchema })
                await retryEntered.promise
                try {
                    expect(
                        (await getTickets(fix, pickIds(heldTickets))).every(
                            (ticket) => ticket.status === TicketStatus.Available
                        )
                    ).toBe(true)
                    expect(await records.findCompleted({ userId: user.id })).toEqual([])
                    expect(emit).not.toHaveBeenCalled()
                } finally {
                    release.resolve()
                }
                await request
                expect(payment).toHaveBeenCalledTimes(1)
                expect(
                    (await getTickets(fix, pickIds(heldTickets))).every(
                        (ticket) => ticket.status === TicketStatus.Sold
                    )
                ).toBe(true)
            })

            it('업무상 거절은 보상을 끝까지 재시도하고 최초 오류 응답을 재생한다', async () => {
                const ticketPurchase = fix.module.get(TicketPurchaseService)
                vi.spyOn(ticketPurchase, 'completePurchase').mockRejectedValueOnce(
                    new BadRequestException(Errors.Purchase.NotHeld())
                )
                const payments = fix.module.get(PaymentsService)
                const cancel = payments.cancelByPurchaseRecordId.bind(payments)
                vi.spyOn(payments, 'cancelByPurchaseRecordId').mockImplementationOnce(
                    async (input) => {
                        await cancel(input)
                        throw new Error('cancellation response lost')
                    }
                )
                const idempotencyKey = randomUUID()
                const send = () =>
                    new HttpTestClient(fix.httpClient.serverUrl)
                        .post('/purchases')
                        .headers({
                            Authorization: `Bearer ${accessToken}`,
                            'Idempotency-Key': idempotencyKey
                        })
                        .body(buildCreatePurchaseDto(heldTickets))
                        .badRequest({ expected: Errors.Purchase.NotHeld() })
                const first = await send()
                expect((await send()).body).toEqual(first.body)
                const records = fix.module.get(PurchaseRecordsService)
                const operation = ensure(
                    await records.findIdempotencyOperation({ userId: user.id, idempotencyKey })
                )
                expect(operation.status).toBe(PurchaseRecordStatus.Cancelled)
                expect(await records.findCompleted({ userId: user.id })).toEqual([])
                const payment = ensure(
                    await fix.module
                        .get(PaymentsRepository)
                        .findByPurchaseRecordId({ purchaseRecordId: operation.purchaseRecord.id })
                )
                expect(payment.status).toBe(PaymentStatus.Cancelled)
                expect(
                    (await getTickets(fix, pickIds(heldTickets))).every(
                        (ticket) => ticket.status === TicketStatus.Available
                    )
                ).toBe(true)
                const cache = fix.module.get<CacheService>(CacheService.getName('ticket-holding'))
                for (const ticket of heldTickets) {
                    expect(await cache.get(`Ticket:{${ticket.showtimeId}}:${ticket.id}`)).toBeNull()
                }
            })

            it('알림 장애는 구매 응답을 막지 않고 별도 workflow에서 복구한다', async () => {
                const events = fix.module.get(PurchaseEvents)
                const publish = events.emitTicketPurchased.bind(events)
                const retryEntered = Promise.withResolvers<void>()
                const release = Promise.withResolvers<void>()
                const emit = vi
                    .spyOn(events, 'emitTicketPurchased')
                    .mockRejectedValueOnce(new Error('broker unavailable'))
                    .mockImplementationOnce(async (event) => {
                        retryEntered.resolve()
                        await release.promise
                        await publish(event)
                        throw new Error('publish acknowledgement lost')
                    })
                const idempotencyKey = randomUUID()
                const send = () =>
                    new HttpTestClient(fix.httpClient.serverUrl)
                        .post('/purchases')
                        .headers({
                            Authorization: `Bearer ${accessToken}`,
                            'Idempotency-Key': idempotencyKey
                        })
                        .body(buildCreatePurchaseDto(heldTickets))
                        .created({ schema: PurchaseRecordSchema })
                const { body: record }: { body: PurchaseRecordDto } = await send()
                const stored = await fix.module
                    .get(PurchaseRecordsRepository)
                    .get({ id: record.id })
                await retryEntered.promise
                try {
                    expect(stored).not.toHaveProperty('purchaseEventStatus')
                    expect(
                        (await getTickets(fix, pickIds(heldTickets))).every(
                            (ticket) => ticket.status === TicketStatus.Sold
                        )
                    ).toBe(true)
                    expect(
                        ensure((await getPayments(fix, [ensure(record.paymentId)]))[0]).status
                    ).toBe(PaymentStatus.Completed)
                    expect((await send()).body).toEqual(record)
                } finally {
                    release.resolve()
                }
                const client = fix.module.get(PurchaseEventWorkflowClient)
                await client.waitForCompletion(await client.submit(record, record.id))
                expect(
                    await fix.module.get(PurchaseRecordsRepository).get({ id: record.id })
                ).toEqual(stored)
                expect(emit).toHaveBeenCalledTimes(3)
                expect((await send()).body).toEqual(record)
            })

            it('이미 판매된 티켓을 다시 구매하려 하면 409를 반환한다', async () => {
                const createDto = buildCreatePurchaseDto(heldTickets)
                await fix.httpClient
                    .post('/purchases')
                    .headers({ 'Idempotency-Key': randomUUID() })
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body(createDto)
                    .created({ schema: PurchaseRecordSchema })

                await fix.httpClient
                    .post('/purchases')
                    .headers({ 'Idempotency-Key': randomUUID() })
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body(createDto)
                    .conflict({ expected: Errors.Purchase.AlreadySold(pickIds(heldTickets)) })
            })

            it('구매 예약 저장 실패는 결제 전에 재시도한다', async () => {
                const repository = fix.module.get(PurchaseRecordsRepository)
                const payment = vi.spyOn(fix.module.get(PaymentsService), 'create')
                const insert = vi
                    .spyOn(repository.collection, 'insertOne')
                    .mockImplementationOnce(async () => {
                        expect(payment).not.toHaveBeenCalled()
                        throw new Error('record creation failed')
                    })
                await fix.httpClient
                    .post('/purchases')
                    .headers({
                        Authorization: `Bearer ${accessToken}`,
                        'Idempotency-Key': randomUUID()
                    })
                    .body(buildCreatePurchaseDto(heldTickets))
                    .created({ schema: PurchaseRecordSchema })
                expect(insert).toHaveBeenCalledTimes(2)
                expect(payment).toHaveBeenCalledTimes(1)
            })

            it('문자열 HttpException도 같은 키 재시도에서 같은 상태와 본문을 반환한다', async () => {
                const ticketPurchaseService = fix.module.get(TicketPurchaseService)
                vi.spyOn(ticketPurchaseService, 'claimPurchase').mockRejectedValueOnce(
                    new HttpException('purchase dependency rejected the request', 418)
                )
                const createDto = buildCreatePurchaseDto(heldTickets)
                const idempotencyKey = randomUUID()

                const first = await fix.httpClient
                    .post('/purchases')
                    .headers({
                        Authorization: `Bearer ${accessToken}`,
                        'Idempotency-Key': idempotencyKey
                    })
                    .body(createDto)
                    .sendRaw()
                const replay = await fix.httpClient
                    .post('/purchases')
                    .headers({
                        Authorization: `Bearer ${accessToken}`,
                        'Idempotency-Key': idempotencyKey
                    })
                    .body(createDto)
                    .sendRaw()

                expect({ body: replay.body, status: replay.status }).toEqual({
                    body: first.body,
                    status: first.status
                })
                expect(first.status).toBe(418)
            })
        })

        it('티켓을 보유하지 않은 채로 구매하면 400을 반환한다', async () => {
            const tickets = await createShowtimeAndTickets(fix)

            const createDto = buildCreatePurchaseDto(tickets.slice(0, 1))

            await fix.httpClient
                .post('/purchases')
                .headers({ 'Idempotency-Key': randomUUID() })
                .headers({ Authorization: `Bearer ${accessToken}` })
                .body(createDto)
                .badRequest({ expected: Errors.Purchase.NotHeld() })
        })

        it('다른 사용자가 보유한 티켓을 구매하면 400을 반환한다', async () => {
            const tickets = await createShowtimeAndTickets(fix)
            // 보유 검증은 결제자 본인의 보유만 인정한다 — 남이 선점한 좌석은 미보유와 동일하게 거절돼야 한다.
            const heldByOther = await holdTickets(fix, oid(0xff), tickets)

            const createDto = buildCreatePurchaseDto(heldByOther)

            await fix.httpClient
                .post('/purchases')
                .headers({ 'Idempotency-Key': randomUUID() })
                .headers({ Authorization: `Bearer ${accessToken}` })
                .body(createDto)
                .badRequest({ expected: Errors.Purchase.NotHeld() })
        })

        it('보유 검증 뒤 다른 고객에게 넘어간 티켓을 판매하지 않는다', async () => {
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
            vi.spyOn(ticketPurchaseService, 'validatePurchase').mockImplementationOnce(
                async (...args) => {
                    await validatePurchase(...args)
                    validationFinished()
                    await mayContinue
                }
            )

            const paymentsService = fix.module.get(PaymentsService)
            const createPayment = vi.spyOn(paymentsService, 'create')

            const purchasePromise = fix.httpClient
                .post('/purchases')
                .headers({ 'Idempotency-Key': randomUUID() })
                .headers({ Authorization: `Bearer ${accessToken}` })
                .body(buildCreatePurchaseDto(heldByFirst))
                .badRequest({ expected: Errors.Purchase.NotHeld() })

            const ticketHoldingService = fix.module.get(TicketHoldingService)
            try {
                await Promise.race([
                    validationDidFinish,
                    purchasePromise.then(() => {
                        throw new Error('보유 검증 barrier에 도달하기 전에 구매 요청이 종료됐다.')
                    })
                ])

                const cache = fix.module.get<CacheService>(CacheService.getName('ticket-holding'))
                await Promise.all([
                    ...heldByFirst.map((ticket) =>
                        cache.delete(`Ticket:{${showtimeId}}:${ticket.id}`)
                    ),
                    cache.delete(`User:{${showtimeId}}:${user.id}`)
                ])

                expect(
                    await ticketHoldingService.holdTickets({
                        showtimeId,
                        ticketIds: pickIds(heldByFirst),
                        userId: secondUserId
                    })
                ).toBe(true)
            } finally {
                continuePurchase()
                await purchasePromise
            }

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
            vi.spyOn(paymentsService, 'create').mockImplementationOnce(async (dto) => {
                paymentStarted()
                await mayContinuePayment
                const payment = await createPayment(dto)
                paymentId = payment.id
                return payment
            })

            const purchasePromise = fix.httpClient
                .post('/purchases')
                .headers({ 'Idempotency-Key': randomUUID() })
                .headers({ Authorization: `Bearer ${accessToken}` })
                .body(buildCreatePurchaseDto(heldByFirst))
                .badRequest({ expected: Errors.Purchase.NotHeld() })

            const ticketHoldingService = fix.module.get(TicketHoldingService)
            try {
                // PaymentService 진입은 pending 기록과 purchase owner claim이 모두 끝났다는 뜻이다.
                await Promise.race([
                    didStartPayment,
                    purchasePromise.then(() => {
                        throw new Error('결제 barrier에 도달하기 전에 구매 요청이 종료됐다.')
                    })
                ])
                const cache = fix.module.get<CacheService>(CacheService.getName('ticket-holding'))
                await Promise.all(
                    heldByFirst.map((ticket) => cache.delete(`Ticket:{${showtimeId}}:${ticket.id}`))
                )

                expect(
                    await ticketHoldingService.holdTickets({
                        showtimeId,
                        ticketIds: pickIds(heldByFirst),
                        userId: secondUserId
                    })
                ).toBe(true)
            } finally {
                continuePayment()
                await purchasePromise
            }

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
    })
})
