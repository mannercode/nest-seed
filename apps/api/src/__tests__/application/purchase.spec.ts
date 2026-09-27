import { CacheService, DateUtil, ensure, pickIds, Require } from '@mannercode/common'
import { HttpTestClient, oid } from '@mannercode/testing'
import { randomUUID } from 'node:crypto'
import type { MockInstance } from 'vitest'
import { PurchaseEventService } from '#application'
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
        describe('사용자가 티켓을 선점했으면', () => {
            let heldTickets: TicketDto[]

            beforeEach(async () => {
                const tickets = await createShowtimeAndTickets(fix)
                heldTickets = await holdTickets(fix, user.id, tickets)
            })

            describe('Idempotency-Key가 없으면', () => {
                let request: typeof fix.httpClient
                beforeEach(() => {
                    request = fix.httpClient
                        .post('/purchases')
                        .headers({ Authorization: `Bearer ${accessToken}` })
                        .body(buildCreatePurchaseDto(heldTickets))
                })
                it('구매를 요청하면 400을 반환한다', async () => {
                    await request.badRequest({ expected: Errors.Idempotency.KeyRequired() })
                })
            })

            describe('결제 금액이 문자열이면', () => {
                let request: typeof fix.httpClient
                beforeEach(() => {
                    const createDto = buildCreatePurchaseDto(heldTickets)
                    request = fix.httpClient
                        .post('/purchases')
                        .headers({
                            Authorization: `Bearer ${accessToken}`,
                            'Idempotency-Key': randomUUID()
                        })
                        .body({ ...createDto, totalPrice: String(createDto.totalPrice) })
                })
                it('구매를 요청하면 400을 반환한다', async () => {
                    await request.badRequest()
                })
            })

            describe('Idempotency-Key 형식이 잘못되었으면', () => {
                let request: typeof fix.httpClient
                beforeEach(() => {
                    request = fix.httpClient
                        .post('/purchases')
                        .headers({
                            Authorization: `Bearer ${accessToken}`,
                            'Idempotency-Key': 'short'
                        })
                        .body(buildCreatePurchaseDto(heldTickets))
                })
                it('구매를 요청하면 400을 반환한다', async () => {
                    await request.badRequest({ expected: Errors.Idempotency.KeyInvalid() })
                })
            })

            describe('워크플로 접수 응답 유실로 같은 요청이 다시 제출되도록 설정하면', () => {
                let createPayment: MockInstance<PaymentsService['create']>
                beforeEach(async () => {
                    createPayment = vi.spyOn(fix.module.get(PaymentsService), 'create')
                    const client = fix.module.get(PurchaseWorkflowClient)
                    const submit = client.submit.bind(client)
                    vi.spyOn(client, 'submit').mockImplementationOnce(async (...args) => {
                        const accepted = await submit(...args)
                        await client.waitForCompletion(accepted)
                        // 최초 접수 응답 유실로 SDK가 같은 요청을 다시 제출한 상황이다.
                        return submit(...args)
                    })
                })
                it('구매를 요청하고 같은 키로 다시 보내도 결제는 한 번만 생성하고 같은 결과를 반환한다', async () => {
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
            })

            describe('구매 기록 저장이 지연되면', () => {
                let entered: ReturnType<typeof Promise.withResolvers<void>>
                let release: ReturnType<typeof Promise.withResolvers<void>>
                let create: MockInstance<PurchaseRecordsService['create']>
                let createPayment: MockInstance<PaymentsService['create']>
                beforeEach(async () => {
                    const records = fix.module.get(PurchaseRecordsService)
                    const createRecord = records.create.bind(records)
                    entered = Promise.withResolvers<void>()
                    release = Promise.withResolvers<void>()
                    create = vi.spyOn(records, 'create').mockImplementationOnce(async (...args) => {
                        entered.resolve()
                        await release.promise
                        return createRecord(...args)
                    })
                    createPayment = vi.spyOn(fix.module.get(PaymentsService), 'create')
                })
                it('저장 전에 같은 키로 요청하면 409를 반환하고 완료 후에는 최초 결과를 반환한다', async () => {
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
            })

            describe('첫 티켓 조회가 지연되면', () => {
                let createPayment: MockInstance<PaymentsService['create']>
                let didReach: Promise<void>
                let release: () => void
                beforeEach(async () => {
                    const tickets = fix.module.get(TicketsService)
                    const getMany = tickets.getMany.bind(tickets)
                    createPayment = vi.spyOn(fix.module.get(PaymentsService), 'create')
                    let reached!: () => void
                    didReach = new Promise<void>((resolve) => {
                        reached = resolve
                    })
                    const mayRead = new Promise<void>((resolve) => {
                        release = resolve
                    })
                    vi.spyOn(tickets, 'getMany').mockImplementationOnce(async (...args) => {
                        reached()
                        await mayRead
                        return getMany(...args)
                    })
                })
                it('같은 키의 두 번째 구매가 먼저 완료되어도 두 요청에 같은 결과를 반환한다', async () => {
                    const createDto = buildCreatePurchaseDto(heldTickets)
                    const key = randomUUID()
                    const send = () =>
                        new HttpTestClient(fix.httpClient.serverUrl)
                            .post('/purchases')
                            .headers({
                                Authorization: `Bearer ${accessToken}`,
                                'Idempotency-Key': key
                            })
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
            })

            describe('첫 구매 기록의 저장이 두 번째 저장 요청까지 지연되면', () => {
                let createCallCount: number
                let didEnterFirstCreate: Promise<void>
                beforeEach(async () => {
                    const purchaseRecordsService = fix.module.get(PurchaseRecordsService)
                    const createRecord = purchaseRecordsService.create.bind(purchaseRecordsService)
                    createCallCount = 0
                    let firstCreateEntered!: () => void
                    didEnterFirstCreate = new Promise<void>((resolve) => {
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
                    vi.spyOn(purchaseRecordsService, 'create').mockImplementation(
                        async (...args) => {
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
                        }
                    )
                })
                it('서로 다른 티켓을 같은 키로 구매하면 먼저 저장한 요청은 성공하고 나머지는 409를 반환한다', async () => {
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
            })

            describe('이전에 구매를 완료했으면', () => {
                let createDto: ReturnType<typeof buildCreatePurchaseDto>
                let idempotencyKey: string
                beforeEach(async () => {
                    createDto = buildCreatePurchaseDto(heldTickets)
                    idempotencyKey = randomUUID()

                    await fix.httpClient
                        .post('/purchases')
                        .headers({
                            Authorization: `Bearer ${accessToken}`,
                            'Idempotency-Key': idempotencyKey
                        })
                        .body(createDto)
                        .created({ schema: PurchaseRecordSchema })
                })
                it('같은 키를 다른 요청 본문에 재사용하면 409를 반환한다', async () => {
                    await fix.httpClient
                        .post('/purchases')
                        .headers({
                            Authorization: `Bearer ${accessToken}`,
                            'Idempotency-Key': idempotencyKey
                        })
                        .body({ ...createDto, totalPrice: createDto.totalPrice + 1 })
                        .conflict({ expected: Errors.Idempotency.KeyReused() })
                })

                it('이미 판매된 티켓을 다시 구매하려 하면 409를 반환한다', async () => {
                    await fix.httpClient
                        .post('/purchases')
                        .headers({ 'Idempotency-Key': randomUUID() })
                        .headers({ Authorization: `Bearer ${accessToken}` })
                        .body(createDto)
                        .conflict({ expected: Errors.Purchase.AlreadySold(pickIds(heldTickets)) })
                })
            })

            describe('첫 결제 생성이 지연되면', () => {
                let didStartPayment: Promise<void>
                let continuePayment: () => void
                beforeEach(async () => {
                    const paymentsService = fix.module.get(PaymentsService)
                    const createPayment = paymentsService.create.bind(paymentsService)
                    let paymentStarted!: () => void
                    didStartPayment = new Promise<void>((resolve) => {
                        paymentStarted = resolve
                    })
                    const mayContinuePayment = new Promise<void>((resolve) => {
                        continuePayment = resolve
                    })
                    vi.spyOn(paymentsService, 'create').mockImplementationOnce(async (dto) => {
                        paymentStarted()
                        await mayContinuePayment
                        return createPayment(dto)
                    })
                })
                it('첫 구매를 처리하는 동안 같은 키로 요청하면 409를 반환한다', async () => {
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
            })

            describe('금액이 맞지 않아 구매 요청이 거절되었으면', () => {
                let idempotencyKey: string
                let createDto: ReturnType<typeof buildCreatePurchaseDto>
                beforeEach(async () => {
                    idempotencyKey = randomUUID()
                    createDto = buildCreatePurchaseDto(heldTickets)

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
                })
                it('금액을 수정해 같은 키로 요청하면 구매를 완료한다', async () => {
                    await fix.httpClient
                        .post('/purchases')
                        .headers({
                            Authorization: `Bearer ${accessToken}`,
                            'Idempotency-Key': idempotencyKey
                        })
                        .body(createDto)
                        .created({ schema: PurchaseRecordSchema })
                })
            })

            describe.each([
                { label: '같은 ID의', duplicateId: (id: string) => id },
                { label: '대소문자만 다른 ID의', duplicateId: (id: string) => id.toUpperCase() }
            ])('요청에 $label 중복 티켓이 있으면', ({ duplicateId }) => {
                let ticket: TicketDto
                let headers: Record<string, string>
                let request: typeof fix.httpClient
                beforeEach(() => {
                    ticket = ensure(heldTickets[0])
                    const idempotencyKey = randomUUID()
                    headers = {
                        Authorization: `Bearer ${accessToken}`,
                        'Idempotency-Key': idempotencyKey
                    }
                    const invalidDto = buildCreatePurchaseDto([
                        ticket,
                        { ...ticket, id: duplicateId(ticket.id) }
                    ])
                    request = fix.httpClient.post('/purchases').headers(headers).body(invalidDto)
                })
                it('구매를 요청하면 400을 반환하고 같은 키로 정상 구매할 수 있다', async () => {
                    await request.badRequest({ expected: Errors.Purchase.DuplicateTickets() })

                    expect(
                        await fix.module
                            .get(PurchaseRecordsRepository)
                            .collection.countDocuments({ userId: user.id })
                    ).toBe(0)
                    expect(
                        await fix.module
                            .get(PaymentsRepository)
                            .collection.countDocuments({ userId: user.id })
                    ).toBe(0)
                    expect(
                        await fix.module
                            .get(TicketHoldingService)
                            .searchHeldTicketIds(ticket.showtimeId, user.id)
                    ).toEqual(pickIds(heldTickets))

                    const correctedDto = buildCreatePurchaseDto([ticket])
                    await fix.httpClient
                        .post('/purchases')
                        .headers(headers)
                        .body(correctedDto)
                        .created({
                            schema: PurchaseRecordSchema,
                            expected: {
                                ...correctedDto,
                                userId: user.id,
                                createdAt: expect.any(Temporal.Instant),
                                id: expect.any(String),
                                paymentId: expect.any(String),
                                updatedAt: expect.any(Temporal.Instant)
                            }
                        })
                })
            })

            it('구매를 요청하면 구매 기록을 반환하고 결제 금액과 티켓 판매 상태를 저장한다', async () => {
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

            describe('판매 후 선점 해제가 실패하도록 설정하면', () => {
                beforeEach(() => {
                    const ticketHoldingService = fix.module.get(TicketHoldingService)
                    vi.spyOn(ticketHoldingService, 'releasePurchaseClaims').mockRejectedValueOnce(
                        new Error('redis cleanup failed')
                    )
                })
                it('구매 요청은 성공하고 티켓은 판매 상태로 남는다', async () => {
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
            })

            describe('구매 수량 제한이 선점한 티켓 수보다 작으면', () => {
                beforeEach(async () => {
                    await overrideConfigGetter(fix.module, 'ticket', {
                        maxPerPurchase: heldTickets.length - 1
                    })
                })
                it('선점한 티켓을 모두 구매하려 하면 400을 반환한다', async () => {
                    const createDto = buildCreatePurchaseDto(heldTickets)

                    await fix.httpClient
                        .post('/purchases')
                        .headers({ 'Idempotency-Key': randomUUID() })
                        .headers({ Authorization: `Bearer ${accessToken}` })
                        .body(createDto)
                        .badRequest({ expected: Errors.Purchase.LimitExceeded(expect.any(Number)) })
                })
            })

            describe('서로 다른 상영의 티켓을 선점했으면', () => {
                let otherHeldTickets: TicketDto[]
                beforeEach(async () => {
                    const otherTickets = await createShowtimeAndTickets(fix)
                    otherHeldTickets = await holdTickets(fix, user.id, otherTickets)
                })
                it('티켓을 섞어 구매 요청을 보내면 400을 반환하고 선점을 유지한다', async () => {
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
                        expect(
                            await holding.searchHeldTicketIds(ticket.showtimeId, user.id)
                        ).toContain(ticket.id)
                    }
                    expect(
                        await fix.module
                            .get(PurchaseRecordsService)
                            .findIdempotencyOperation({ userId: user.id, idempotencyKey })
                    ).toBeUndefined()
                })
            })

            describe('구매 마감 시간을 지난 상영이 존재하면', () => {
                let config: AppConfigService
                let startTime: Temporal.Instant
                beforeEach(async () => {
                    config = fix.module.get(AppConfigService)
                    const [showtime] = await fix.module
                        .get(ShowtimesService)
                        .getMany([ensure(heldTickets[0]).showtimeId])
                    startTime = ensure(showtime).startTime
                    await overrideConfigGetter(fix.module, 'ticket', {
                        purchaseCutoffMinutes: config.ticket.purchaseCutoffMinutes + 2
                    })
                })
                it('티켓 구매를 요청하면 400을 반환한다', async () => {
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
            })

            describe('요청 금액이 서버에서 계산한 금액과 다르면', () => {
                let request: typeof fix.httpClient
                beforeEach(() => {
                    const createDto = buildCreatePurchaseDto(heldTickets, { totalPrice: 1 })
                    request = fix.httpClient
                        .post('/purchases')
                        .headers({ 'Idempotency-Key': randomUUID() })
                        .headers({ Authorization: `Bearer ${accessToken}` })
                        .body(createDto)
                })
                it('구매를 요청하면 400을 반환한다', async () => {
                    await request.badRequest({
                        expected: Errors.Purchase.TotalPriceMismatch(expect.any(Number), 1)
                    })
                })
            })

            describe.each([
                {
                    label: '선점·결제·구매 완료 응답이 유실되도록 설정하면',
                    failure: new Error('commit response lost')
                },
                {
                    label: '선점·결제 응답이 유실되고 구매 완료 뒤 오류가 발생하도록 설정하면',
                    failure: new BadRequestException(Errors.Purchase.NotHeld())
                }
            ])('$label', ({ failure }) => {
                beforeEach(() => {
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
                })

                it('구매를 요청하면 결제를 중복 생성하지 않고 최초 구매 결과와 판매 상태를 유지한다', async () => {
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
                })
            })

            describe('구매 완료 저장의 첫 호출이 실패하고 재시도가 지연되면', () => {
                let records: PurchaseRecordsService
                let retryEntered: ReturnType<typeof Promise.withResolvers<void>>
                let release: ReturnType<typeof Promise.withResolvers<void>>
                let emit: MockInstance<PurchaseEventService['emitTicketPurchased']>
                let payment: MockInstance<PaymentsService['create']>
                beforeEach(async () => {
                    records = fix.module.get(PurchaseRecordsService)
                    const complete = records.markCompleted.bind(records)
                    retryEntered = Promise.withResolvers<void>()
                    release = Promise.withResolvers<void>()
                    vi.spyOn(records, 'markCompleted')
                        .mockRejectedValueOnce(new Error('transaction failed'))
                        .mockImplementationOnce(async (...args) => {
                            retryEntered.resolve()
                            await release.promise
                            return complete(...args)
                        })
                    emit = vi.spyOn(fix.module.get(PurchaseEventService), 'emitTicketPurchased')
                    payment = vi.spyOn(fix.module.get(PaymentsService), 'create')
                })
                it('구매 요청은 재시도 전에 판매를 되돌리고 결제 하나로 구매를 완료한다', async () => {
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
            })

            describe('구매 완료 처리가 거절되고 결제 취소 응답도 유실되도록 설정하면', () => {
                beforeEach(async () => {
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
                })
                it('구매 요청은 결제를 취소하고 같은 키의 재요청에는 최초 오류를 반환한다', async () => {
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
                            .findByPurchaseRecordId({
                                purchaseRecordId: operation.purchaseRecord.id
                            })
                    )
                    expect(payment.status).toBe(PaymentStatus.Cancelled)
                    expect(
                        (await getTickets(fix, pickIds(heldTickets))).every(
                            (ticket) => ticket.status === TicketStatus.Available
                        )
                    ).toBe(true)
                    const cache = fix.module.get<CacheService>(
                        CacheService.getName('ticket-holding')
                    )
                    for (const ticket of heldTickets) {
                        expect(
                            await cache.get(`Ticket:{${ticket.showtimeId}}:${ticket.id}`)
                        ).toBeNull()
                    }
                })
            })

            describe('첫 알림 발행은 실패하고 재시도의 응답도 유실되도록 설정하면', () => {
                let retryEntered: ReturnType<typeof Promise.withResolvers<void>>
                let release: ReturnType<typeof Promise.withResolvers<void>>
                let emit: MockInstance<PurchaseEventService['emitTicketPurchased']>
                beforeEach(async () => {
                    const events = fix.module.get(PurchaseEventService)
                    const publish = events.emitTicketPurchased.bind(events)
                    retryEntered = Promise.withResolvers<void>()
                    release = Promise.withResolvers<void>()
                    emit = vi
                        .spyOn(events, 'emitTicketPurchased')
                        .mockRejectedValueOnce(new Error('broker unavailable'))
                        .mockImplementationOnce(async (event) => {
                            retryEntered.resolve()
                            await release.promise
                            await publish(event)
                            throw new Error('publish acknowledgement lost')
                        })
                })
                it('구매 완료를 먼저 응답하고 알림 발행을 재시도해도 구매 결과는 유지한다', async () => {
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
            })

            describe('구매 기록의 첫 저장이 실패하도록 설정하면', () => {
                let payment: MockInstance<PaymentsService['create']>
                let insert: MockInstance<PurchaseRecordsRepository['collection']['insertOne']>
                beforeEach(() => {
                    const repository = fix.module.get(PurchaseRecordsRepository)
                    payment = vi.spyOn(fix.module.get(PaymentsService), 'create')
                    insert = vi
                        .spyOn(repository.collection, 'insertOne')
                        .mockImplementationOnce(async () => {
                            expect(payment).not.toHaveBeenCalled()
                            throw new Error('record creation failed')
                        })
                })
                it('구매를 요청하면 기록을 다시 저장한 뒤 결제한다', async () => {
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
            })

            describe('구매 선점 할당이 문자열 본문의 HTTP 예외를 던지도록 설정하면', () => {
                beforeEach(() => {
                    const ticketPurchaseService = fix.module.get(TicketPurchaseService)
                    vi.spyOn(ticketPurchaseService, 'claimPurchase').mockRejectedValueOnce(
                        new HttpException('purchase dependency rejected the request', 418)
                    )
                })
                it('같은 키로 구매를 재요청하면 최초 오류의 상태 코드와 본문을 반환한다', async () => {
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
        })

        describe('아무도 선점하지 않은 티켓이 존재하면', () => {
            let tickets: TicketDto[]
            beforeEach(async () => {
                tickets = await createShowtimeAndTickets(fix)
            })
            it('티켓 구매를 요청하면 400을 반환한다', async () => {
                const createDto = buildCreatePurchaseDto(tickets.slice(0, 1))

                await fix.httpClient
                    .post('/purchases')
                    .headers({ 'Idempotency-Key': randomUUID() })
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body(createDto)
                    .badRequest({ expected: Errors.Purchase.NotHeld() })
            })
        })

        describe('다른 사용자가 티켓을 선점했으면', () => {
            let heldByOther: TicketDto[]
            beforeEach(async () => {
                const tickets = await createShowtimeAndTickets(fix)
                // 선점 검증은 결제자 본인의 선점만 인정한다 — 남이 선점한 좌석은 선점하지 않은 경우와 동일하게 거절돼야 한다.
                heldByOther = await holdTickets(fix, oid(0xff), tickets)
            })
            it('그 티켓의 구매를 요청하면 400을 반환한다', async () => {
                const createDto = buildCreatePurchaseDto(heldByOther)

                await fix.httpClient
                    .post('/purchases')
                    .headers({ 'Idempotency-Key': randomUUID() })
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .body(createDto)
                    .badRequest({ expected: Errors.Purchase.NotHeld() })
            })
        })

        describe('사용자가 티켓을 선점했고 구매 검증 직후 처리가 지연되면', () => {
            let heldByFirst: TicketDto[]
            let showtimeId: string
            let secondUserId: string
            let validationDidFinish: Promise<void>
            let continuePurchase: () => void
            let createPayment: MockInstance<PaymentsService['create']>
            beforeEach(async () => {
                const tickets = await createShowtimeAndTickets(fix)
                heldByFirst = await holdTickets(fix, user.id, tickets)
                showtimeId = ensure(heldByFirst[0]).showtimeId
                secondUserId = oid(0xc2)

                const ticketPurchaseService = fix.module.get(TicketPurchaseService)
                const validatePurchase =
                    ticketPurchaseService.validatePurchase.bind(ticketPurchaseService)
                let validationFinished!: () => void
                validationDidFinish = new Promise<void>((resolve) => {
                    validationFinished = resolve
                })
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
                createPayment = vi.spyOn(paymentsService, 'create')
            })
            it('구매 중 다른 사용자에게 선점이 넘어가면 결제를 만들지 않고 구매를 거절한다', async () => {
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
                            throw new Error(
                                '선점 검증 barrier에 도달하기 전에 구매 요청이 종료됐다.'
                            )
                        })
                    ])

                    const cache = fix.module.get<CacheService>(
                        CacheService.getName('ticket-holding')
                    )
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

                // 결제 전에 hold owner를 purchase record로 claim해야 한다. 검증 뒤 다른 사용자가
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
        })

        describe('사용자가 티켓을 선점했고 결제 생성이 지연되면', () => {
            let heldByFirst: TicketDto[]
            let showtimeId: string
            let secondUserId: string
            let didStartPayment: Promise<void>
            let continuePayment: () => void
            let paymentId: string | undefined
            beforeEach(async () => {
                const tickets = await createShowtimeAndTickets(fix)
                heldByFirst = await holdTickets(fix, user.id, tickets)
                showtimeId = ensure(heldByFirst[0]).showtimeId
                secondUserId = oid(0xc3)

                const paymentsService = fix.module.get(PaymentsService)
                const createPayment = paymentsService.create.bind(paymentsService)
                let paymentStarted!: () => void
                didStartPayment = new Promise<void>((resolve) => {
                    paymentStarted = resolve
                })
                const mayContinuePayment = new Promise<void>((resolve) => {
                    continuePayment = resolve
                })
                paymentId = undefined
                vi.spyOn(paymentsService, 'create').mockImplementationOnce(async (dto) => {
                    paymentStarted()
                    await mayContinuePayment
                    const payment = await createPayment(dto)
                    paymentId = payment.id
                    return payment
                })
            })
            it('구매 중 선점 키를 지우고 다른 사용자가 선점하면 결제를 취소하고 구매를 거절한다', async () => {
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
                    const cache = fix.module.get<CacheService>(
                        CacheService.getName('ticket-holding')
                    )
                    await Promise.all(
                        heldByFirst.map((ticket) =>
                            cache.delete(`Ticket:{${showtimeId}}:${ticket.id}`)
                        )
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
})
