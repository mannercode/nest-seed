import type { MockInstance } from 'vitest'
import {
    DateUtil,
    ensure,
    newObjectIdString,
    sleep,
    paginationResultSchema
} from '@mannercode/common'
import { HttpTestClient, instant, nullObjectId } from '@mannercode/testing'
import { randomUUID } from 'node:crypto'
import {
    type MovieDto,
    ShowtimesService,
    type TheaterDto,
    TicketsService,
    MovieSchema,
    TheaterSchema,
    ShowtimeSchema
} from '#core'
import {
    ShowtimeCreationPersistenceService,
    ShowtimeCreationStatusResponseSchema,
    ShowtimeCreationSubmissionRepository
} from '../../services/application/showtime-creation/internal/index.js'
import {
    createAndLoginAdmin,
    createMovie,
    createShowtimes,
    createTheater,
    Errors,
    type AppTestContext,
    createAppTestContext
} from '../helpers/index.js'
import { submitAndWaitForCompletion } from './showtime-creation.utils.js'
import {
    BookingShowtimeSchema,
    ShowtimeCreationEventService,
    RequestShowtimeCreationResponseSchema
} from '#application'
import { ShowtimeCreationWorkflowClient } from '../../services/application/showtime-creation/worker/index.js'

describe('ShowtimeCreationService', () => {
    let fix: AppTestContext
    let teardown: AppTestContext['teardown'] | undefined
    let adminAccessToken: string
    let showtimesService: ShowtimesService
    let ticketsService: TicketsService
    let persistence: ShowtimeCreationPersistenceService
    let movie: MovieDto
    let theater: TheaterDto

    beforeEach(async () => {
        teardown = undefined

        fix = await createAppTestContext({ enableRestate: true })
        teardown = fix.teardown
        ;({ accessToken: adminAccessToken } = await createAndLoginAdmin(fix))
        showtimesService = fix.module.get(ShowtimesService)
        ticketsService = fix.module.get(TicketsService)
        persistence = fix.module.get(ShowtimeCreationPersistenceService)

        movie = await createMovie(fix)
        theater = await createTheater(fix)
    })
    afterEach(() => teardown?.())

    const buildCreateDto = () => ({
        durationInMinutes: 1,
        movieId: movie.id,
        startTimes: [instant('2100-01-01T09:00Z')],
        theaterIds: [theater.id]
    })

    describe('GET /showtime-creation/movies', () => {
        describe('검색 조건이 없으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient
                    .get('/showtime-creation/movies')
                    .headers({ Authorization: `Bearer ${adminAccessToken}` })
            })
            it('영화 목록을 조회하면 전체 영화 페이지를 반환한다', async () => {
                await request.ok({
                    schema: paginationResultSchema(MovieSchema),
                    expected: {
                        items: [movie],
                        page: expect.any(Number),
                        size: expect.any(Number),
                        total: 1
                    }
                })
            })
        })
    })

    describe('GET /showtime-creation/theaters', () => {
        describe('검색 조건이 없으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient
                    .get('/showtime-creation/theaters')
                    .headers({ Authorization: `Bearer ${adminAccessToken}` })
            })
            it('극장 목록을 조회하면 전체 극장 페이지를 반환한다', async () => {
                await request.ok({
                    schema: paginationResultSchema(TheaterSchema),
                    expected: {
                        items: [theater],
                        page: expect.any(Number),
                        size: expect.any(Number),
                        total: 1
                    }
                })
            })
        })
    })

    describe('POST /showtime-creation/showtimes/search', () => {
        describe('극장에 상영 세 건이 존재하면', () => {
            let showtimes: Awaited<ReturnType<typeof createShowtimes>>
            beforeEach(async () => {
                showtimes = await createShowtimes(
                    fix,
                    [
                        instant('2100-01-01T09:00Z'),
                        instant('2100-01-01T11:00Z'),
                        instant('2100-01-01T13:00Z')
                    ].map((startTime) => ({ startTime, theaterId: theater.id }))
                )
            })
            it('극장 ID로 검색하면 상영 목록을 반환하고 시각을 UTC 밀리초 문자열로 전송한다', async () => {
                const response = await fix.httpClient
                    .post('/showtime-creation/showtimes/search')
                    .headers({ Authorization: `Bearer ${adminAccessToken}` })
                    .body({ theaterIds: [theater.id] })
                    .ok({
                        schema: ShowtimeSchema.array(),
                        expected: expect.arrayContaining(showtimes)
                    })

                expect(response.text).toContain('"startTime":"2100-01-01T09:00:00.000Z"')
            })
        })
    })

    describe('GET /showtime-creation/event-stream', () => {
        it('SSE의 시각을 UTC 밀리초 3자리 문자열로 전송한다', async () => {
            const events = fix.module.get(ShowtimeCreationEventService)
            const sseClient = new HttpTestClient(fix.httpClient.serverUrl)
            const sagaId = newObjectIdString()
            let received: string | undefined
            let streamError: unknown

            sseClient
                .get('/showtime-creation/event-stream')
                .headers({ Authorization: `Bearer ${adminAccessToken}` })
                .sse(
                    (data) => {
                        if (data.includes(sagaId)) received = data
                    },
                    (error) => {
                        streamError = error
                    }
                )

            const event: Parameters<typeof events.emitStatusChanged>[0] = {
                conflictingShowtimes: [
                    {
                        endTime: instant('2100-01-01T11:00:00Z'),
                        id: newObjectIdString(),
                        movieId: movie.id,
                        startTime: instant('2100-01-01T09:00:00Z'),
                        theaterId: theater.id
                    }
                ],
                sagaId,
                status: 'failed'
            }

            try {
                const deadline = performance.now() + 2_000
                while (!received && performance.now() < deadline) {
                    if (streamError) {
                        throw streamError instanceof Error
                            ? streamError
                            : new Error(
                                  typeof streamError === 'string'
                                      ? streamError
                                      : 'SSE stream failed.'
                              )
                    }
                    await events.emitStatusChanged(event)
                    await sleep(50)
                }
                if (!received) throw new Error('SSE event was not received within 2000ms.')
            } finally {
                sseClient.abort()
            }

            expect(received).toContain('"startTime":"2100-01-01T09:00:00.000Z"')
            expect(received).toContain('"endTime":"2100-01-01T11:00:00.000Z"')
        })
    })

    describe('GET /showtime-creation/showtimes/:sagaId/status', () => {
        describe.each([
            { label: '진행 알림을 발행할 수 있을 때', failNotification: false },
            { label: '진행 알림을 발행할 수 없을 때', failNotification: true }
        ])('$label', ({ failNotification }) => {
            let sagaId: string
            beforeEach(async () => {
                if (failNotification) {
                    vi.spyOn(
                        fix.module.get(ShowtimeCreationEventService),
                        'emitStatusChanged'
                    ).mockRejectedValue(new Error('NATS unavailable'))
                }
                const created = await fix.httpClient
                    .post('/showtime-creation/showtimes')
                    .headers({ Authorization: `Bearer ${adminAccessToken}` })
                    .headers({ 'Idempotency-Key': randomUUID() })
                    .body(buildCreateDto())
                    .accepted({ schema: RequestShowtimeCreationResponseSchema })
                sagaId = created.body.sagaId
            })

            it('SSE를 구독하지 않고 상태를 조회해도 완료 결과와 저장한 개수가 일치한다', async () => {
                const deadline = performance.now() + 5_000
                let status: any

                do {
                    const response = await fix.httpClient
                        .get(`/showtime-creation/showtimes/${sagaId}/status`)
                        .headers({ Authorization: `Bearer ${adminAccessToken}` })
                        .ok({ schema: ShowtimeCreationStatusResponseSchema })
                    status = response.body
                    if (status.status !== 'pending') break
                    await sleep(25)
                } while (performance.now() < deadline)

                expect(status).toEqual({
                    createdShowtimeCount: 1,
                    createdTicketCount: expect.any(Number),
                    sagaId,
                    status: 'succeeded'
                })
                await expect(showtimesService.search({ sagaIds: [sagaId] })).resolves.toHaveLength(
                    status.createdShowtimeCount
                )
                await expect(ticketsService.search({ sagaIds: [sagaId] })).resolves.toHaveLength(
                    status.createdTicketCount
                )
            })
        })

        describe('요청한 관리자에게 작업 접수 기록이 없으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient
                    .get(`/showtime-creation/showtimes/${nullObjectId}/status`)
                    .headers({ Authorization: `Bearer ${adminAccessToken}` })
            })
            it('작업 상태를 조회하면 404를 반환한다', async () => {
                await request.notFound({
                    expected: Errors.ShowtimeCreation.SagaNotFound(nullObjectId)
                })
            })
        })
    })

    describe('POST /showtime-creation/showtimes', () => {
        describe('Idempotency-Key가 없으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient
                    .post('/showtime-creation/showtimes')
                    .headers({ Authorization: `Bearer ${adminAccessToken}` })
                    .body(buildCreateDto())
            })
            it('상영 생성을 요청하면 400을 반환한다', async () => {
                await request.badRequest({ expected: Errors.Idempotency.KeyRequired() })
            })
        })

        describe('Idempotency-Key 형식이 잘못되었으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient
                    .post('/showtime-creation/showtimes')
                    .headers({ Authorization: `Bearer ${adminAccessToken}` })
                    .headers({ 'Idempotency-Key': 'short' })
                    .body(buildCreateDto())
            })
            it('상영 생성을 요청하면 400을 반환한다', async () => {
                await request.badRequest({ expected: Errors.Idempotency.KeyInvalid() })
            })
        })

        describe('이미 접수한 상영 생성 요청이 존재하면', () => {
            let idempotencyKey: string
            let createDto: ReturnType<typeof buildCreateDto>
            let first: Awaited<ReturnType<HttpTestClient['accepted']>>
            beforeEach(async () => {
                idempotencyKey = randomUUID()
                createDto = buildCreateDto()

                first = await fix.httpClient
                    .post('/showtime-creation/showtimes')
                    .headers({ Authorization: `Bearer ${adminAccessToken}` })
                    .headers({ 'Idempotency-Key': idempotencyKey })
                    .body(createDto)
                    .accepted({ schema: RequestShowtimeCreationResponseSchema })
            })
            it('같은 키와 본문으로 다시 요청하면 최초 작업 ID를 반환한다', async () => {
                const replay = await fix.httpClient
                    .post('/showtime-creation/showtimes')
                    .headers({ Authorization: `Bearer ${adminAccessToken}` })
                    .headers({ 'Idempotency-Key': idempotencyKey })
                    .body(createDto)
                    .accepted({ schema: RequestShowtimeCreationResponseSchema })

                expect(replay.body).toEqual(first.body)
            })

            it('같은 키를 다른 요청 본문에 재사용하면 409를 반환한다', async () => {
                await fix.httpClient
                    .post('/showtime-creation/showtimes')
                    .headers({ Authorization: `Bearer ${adminAccessToken}` })
                    .headers({ 'Idempotency-Key': idempotencyKey })
                    .body({ ...createDto, durationInMinutes: createDto.durationInMinutes + 1 })
                    .conflict({ expected: Errors.Idempotency.KeyReused() })
            })
        })

        describe('워크플로 제출이 지연되면', () => {
            let didEnterWorkflowStart: Promise<void>
            let continueWorkflowStart: () => void
            beforeEach(async () => {
                const workflow = fix.module.get(ShowtimeCreationWorkflowClient)
                const submitWorkflow = workflow.submit.bind(workflow)
                let workflowStartEntered!: () => void
                didEnterWorkflowStart = new Promise<void>((resolve) => {
                    workflowStartEntered = resolve
                })
                const mayContinueWorkflowStart = new Promise<void>((resolve) => {
                    continueWorkflowStart = resolve
                })
                vi.spyOn(workflow, 'submit').mockImplementationOnce(async (...args) => {
                    workflowStartEntered()
                    await mayContinueWorkflowStart
                    return submitWorkflow(...args)
                })
            })
            it('최초 요청을 처리하는 동안 같은 키로 다시 요청하면 409를 반환한다', async () => {
                const idempotencyKey = randomUUID()
                const createDto = buildCreateDto()
                const firstClient = new HttpTestClient(fix.httpClient.serverUrl)
                const first = firstClient
                    .post('/showtime-creation/showtimes')
                    .headers({ Authorization: `Bearer ${adminAccessToken}` })
                    .headers({ 'Idempotency-Key': idempotencyKey })
                    .body(createDto)
                    .accepted({ schema: RequestShowtimeCreationResponseSchema })

                await didEnterWorkflowStart
                try {
                    await fix.httpClient
                        .post('/showtime-creation/showtimes')
                        .headers({ Authorization: `Bearer ${adminAccessToken}` })
                        .headers({ 'Idempotency-Key': idempotencyKey })
                        .body(createDto)
                        .conflict({ expected: Errors.Idempotency.RequestInProgress() })
                } finally {
                    continueWorkflowStart()
                }
                await first
            })
        })

        describe('첫 워크플로 제출이 실패하도록 설정하면', () => {
            let submitWorkflow: MockInstance<ShowtimeCreationWorkflowClient['submit']>
            beforeEach(() => {
                const workflow = fix.module.get(ShowtimeCreationWorkflowClient)
                submitWorkflow = vi
                    .spyOn(workflow, 'submit')
                    .mockRejectedValueOnce(
                        new Error('Restate unavailable before workflow submission')
                    )
            })
            it('같은 키로 재요청하면 기존 작업 ID로 다시 제출한다', async () => {
                const idempotencyKey = randomUUID()
                const createDto = buildCreateDto()

                await fix.httpClient
                    .post('/showtime-creation/showtimes')
                    .headers({ Authorization: `Bearer ${adminAccessToken}` })
                    .headers({ 'Idempotency-Key': idempotencyKey })
                    .body(createDto)
                    .internalServerError()

                await fix.httpClient
                    .post('/showtime-creation/showtimes')
                    .headers({ Authorization: `Bearer ${adminAccessToken}` })
                    .headers({ 'Idempotency-Key': idempotencyKey })
                    .body(createDto)
                    .accepted({ schema: RequestShowtimeCreationResponseSchema })

                expect(submitWorkflow).toHaveBeenCalledTimes(2)
                expect(submitWorkflow.mock.calls[1]?.[1]).toBe(submitWorkflow.mock.calls[0]?.[1])
            })
        })

        describe('접수 완료 기록의 첫 저장이 실패하도록 설정하면', () => {
            let workflow: ShowtimeCreationWorkflowClient
            let emitStatusChanged: MockInstance<ShowtimeCreationEventService['emitStatusChanged']>
            let submitWorkflow: MockInstance<ShowtimeCreationWorkflowClient['submit']>
            let markAccepted: MockInstance<ShowtimeCreationSubmissionRepository['markAccepted']>
            beforeEach(() => {
                const events = fix.module.get(ShowtimeCreationEventService)
                workflow = fix.module.get(ShowtimeCreationWorkflowClient)
                const submissions = fix.module.get(ShowtimeCreationSubmissionRepository)
                emitStatusChanged = vi.spyOn(events, 'emitStatusChanged')
                submitWorkflow = vi.spyOn(workflow, 'submit')
                markAccepted = vi
                    .spyOn(submissions, 'markAccepted')
                    .mockRejectedValueOnce(new Error('accepted marker write failed'))
            })
            it('같은 키로 재요청하면 같은 작업을 재접수하고 대기 알림은 한 번만 발행한다', async () => {
                const idempotencyKey = randomUUID()
                const createDto = buildCreateDto()

                await fix.httpClient
                    .post('/showtime-creation/showtimes')
                    .headers({ Authorization: `Bearer ${adminAccessToken}` })
                    .headers({ 'Idempotency-Key': idempotencyKey })
                    .body(createDto)
                    .internalServerError()

                const replay = await fix.httpClient
                    .post('/showtime-creation/showtimes')
                    .headers({ Authorization: `Bearer ${adminAccessToken}` })
                    .headers({ 'Idempotency-Key': idempotencyKey })
                    .body(createDto)
                    .accepted({ schema: RequestShowtimeCreationResponseSchema })

                expect(markAccepted).toHaveBeenCalledTimes(2)
                expect(markAccepted.mock.calls[1]?.[1]).toBe(idempotencyKey)
                const workflowSubmissions = await Promise.all(
                    submitWorkflow.mock.results.map(({ value }) => value)
                )
                expect(workflowSubmissions.map(({ status }) => status)).toEqual([
                    'Accepted',
                    'PreviouslyAccepted'
                ])
                await workflow.waitForCompletion(ensure(workflowSubmissions[0]))
                expect(
                    emitStatusChanged.mock.calls.filter(([event]) => event.status === 'waiting')
                ).toHaveLength(1)
                expect(replay.body).toEqual({ sagaId: expect.any(String) })
            })
        })

        describe('접수 완료 기록의 첫 저장에서 처리 권한 상실을 반환하도록 설정하면', () => {
            let markAccepted: MockInstance<ShowtimeCreationSubmissionRepository['markAccepted']>
            beforeEach(() => {
                const submissions = fix.module.get(ShowtimeCreationSubmissionRepository)
                markAccepted = vi.spyOn(submissions, 'markAccepted').mockResolvedValueOnce(null)
            })
            it('같은 키로 재요청하면 접수를 완료한다', async () => {
                const idempotencyKey = randomUUID()
                const createDto = buildCreateDto()

                await fix.httpClient
                    .post('/showtime-creation/showtimes')
                    .headers({ Authorization: `Bearer ${adminAccessToken}` })
                    .headers({ 'Idempotency-Key': idempotencyKey })
                    .body(createDto)
                    .internalServerError()

                const replay = await fix.httpClient
                    .post('/showtime-creation/showtimes')
                    .headers({ Authorization: `Bearer ${adminAccessToken}` })
                    .headers({ 'Idempotency-Key': idempotencyKey })
                    .body(createDto)
                    .accepted({ schema: RequestShowtimeCreationResponseSchema })

                expect(markAccepted).toHaveBeenCalledTimes(2)
                expect(replay.body).toEqual({ sagaId: expect.any(String) })
            })
        })

        describe('접수 기록 저장이 실패하도록 설정하면', () => {
            let submitWorkflow: MockInstance<ShowtimeCreationWorkflowClient['submit']>
            beforeEach(() => {
                const workflow = fix.module.get(ShowtimeCreationWorkflowClient)
                const submissions = fix.module.get(ShowtimeCreationSubmissionRepository)
                submitWorkflow = vi.spyOn(workflow, 'submit')
                vi.spyOn(submissions.collection, 'insertOne').mockRejectedValueOnce(
                    new Error('submission storage unavailable')
                )
            })
            it('생성을 요청하면 500을 반환하고 워크플로는 제출하지 않는다', async () => {
                await fix.httpClient
                    .post('/showtime-creation/showtimes')
                    .headers({ Authorization: `Bearer ${adminAccessToken}` })
                    .headers({ 'Idempotency-Key': randomUUID() })
                    .body(buildCreateDto())
                    .internalServerError()

                expect(submitWorkflow).not.toHaveBeenCalled()
            })
        })

        describe('상영 시각이 겹쳐 요청이 거절되었으면', () => {
            let idempotencyKey: string
            let createDto: ReturnType<typeof buildCreateDto>
            beforeEach(async () => {
                idempotencyKey = randomUUID()
                createDto = buildCreateDto()

                await fix.httpClient
                    .post('/showtime-creation/showtimes')
                    .headers({ Authorization: `Bearer ${adminAccessToken}` })
                    .headers({ 'Idempotency-Key': idempotencyKey })
                    .body({
                        ...createDto,
                        durationInMinutes: 90,
                        startTimes: [instant('2100-01-01T09:00Z'), instant('2100-01-01T10:00Z')]
                    })
                    .badRequest({
                        expected: Errors.ShowtimeCreation.OverlappingStartTimes(expect.any(Array))
                    })
            })
            it('시각을 수정해 같은 키로 요청하면 접수한다', async () => {
                await fix.httpClient
                    .post('/showtime-creation/showtimes')
                    .headers({ Authorization: `Bearer ${adminAccessToken}` })
                    .headers({ 'Idempotency-Key': idempotencyKey })
                    .body(createDto)
                    .accepted({ schema: RequestShowtimeCreationResponseSchema })
            })
        })

        it('생성을 요청하면 작업 ID와 완료 알림을 반환하고 상영 한 건과 티켓 8개를 저장한다', async () => {
            const result = await submitAndWaitForCompletion(
                fix,
                adminAccessToken,
                'succeeded',
                () =>
                    fix.httpClient
                        .post('/showtime-creation/showtimes')
                        .headers({
                            Authorization: `Bearer ${adminAccessToken}`,
                            'Idempotency-Key': randomUUID()
                        })
                        .body(buildCreateDto())
                        .accepted({ schema: RequestShowtimeCreationResponseSchema })
            )
            expect(result.response.body).toEqual(
                expect.objectContaining({ sagaId: expect.any(String) })
            )
            expect(result.completion).toEqual(
                expect.objectContaining({
                    sagaId: result.response.body.sagaId,
                    status: 'succeeded'
                })
            )
            const createdShowtimes = await showtimesService.search({
                sagaIds: [result.response.body.sagaId]
            })
            expect(result.completion.createdShowtimeCount).toBe(1)
            expect(createdShowtimes).toHaveLength(1)
            const createdTickets = await ticketsService.search({
                sagaIds: [result.response.body.sagaId]
            })
            expect(result.completion.createdTicketCount).toBe(8)
            expect(createdTickets).toHaveLength(8)
        })

        describe.each([
            { label: '극장의 좌석 배치가 비어 있을 때', seatmap: { blocks: [] } },
            {
                label: '극장의 모든 좌석이 비활성일 때',
                seatmap: { blocks: [{ name: 'A', rows: [{ name: '1', layout: 'XXXX' }] }] }
            }
        ])('$label', ({ seatmap }) => {
            beforeEach(async () => {
                await fix.httpClient
                    .patch(`/theaters/${theater.id}`)
                    .headers({ Authorization: `Bearer ${adminAccessToken}` })
                    .body({ seatmap })
                    .ok({ schema: TheaterSchema })
            })

            it('상영은 생성하지만 티켓 수와 판매 집계는 0이다', async () => {
                const { response, completion } = await submitAndWaitForCompletion(
                    fix,
                    adminAccessToken,
                    'succeeded',
                    () =>
                        fix.httpClient
                            .post('/showtime-creation/showtimes')
                            .headers({ Authorization: `Bearer ${adminAccessToken}` })
                            .headers({ 'Idempotency-Key': randomUUID() })
                            .body(buildCreateDto())
                            .accepted({ schema: RequestShowtimeCreationResponseSchema })
                )

                expect(completion.createdShowtimeCount).toBe(1)
                expect(completion.createdTicketCount).toBe(0)
                const showtimes = await showtimesService.search({ sagaIds: [response.body.sagaId] })
                expect(showtimes).toHaveLength(1)
                expect(await ticketsService.search({ sagaIds: [response.body.sagaId] })).toEqual([])

                await fix.httpClient
                    .get(
                        `/booking/movies/${movie.id}/theaters/${theater.id}/showdates/21000101/showtimes`
                    )
                    .ok({
                        schema: BookingShowtimeSchema.array(),
                        expected: showtimes.map((showtime) => ({
                            ...showtime,
                            ticketSales: { available: 0, sold: 0, total: 0 }
                        }))
                    })
            })
        })

        it('상영 생성 상태를 waiting → processing → succeeded 순서로 발행한다', async () => {
            const {
                response: { body },
                events
            } = await submitAndWaitForCompletion(fix, adminAccessToken, 'succeeded', () =>
                fix.httpClient
                    .post('/showtime-creation/showtimes')
                    .headers({ Authorization: `Bearer ${adminAccessToken}` })
                    .headers({ 'Idempotency-Key': randomUUID() })
                    .body(buildCreateDto())
                    .accepted({ schema: RequestShowtimeCreationResponseSchema })
            )

            const statuses = events
                .filter((event) => event.sagaId === body.sagaId)
                .map((event) => event.status)
            expect(statuses).toEqual(['waiting', 'processing', 'succeeded'])
        })

        describe('ID에 해당하는 영화가 없으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient
                    .post('/showtime-creation/showtimes')
                    .headers({ Authorization: `Bearer ${adminAccessToken}` })
                    .headers({ 'Idempotency-Key': randomUUID() })
                    .body({
                        durationInMinutes: 1,
                        movieId: nullObjectId,
                        startTimes: [instant()],
                        theaterIds: [theater.id]
                    })
            })
            it('상영 생성을 요청하면 오류 상태를 전송한다', async () => {
                const {
                    response: { body },
                    completion
                } = await submitAndWaitForCompletion(fix, adminAccessToken, 'error', () =>
                    request.accepted({ schema: RequestShowtimeCreationResponseSchema })
                )

                expect(completion).toEqual({
                    message: 'The requested movie could not be found.',
                    sagaId: body.sagaId,
                    status: 'error'
                })
            })
        })

        describe('ID에 해당하는 극장이 없으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient
                    .post('/showtime-creation/showtimes')
                    .headers({ Authorization: `Bearer ${adminAccessToken}` })
                    .headers({ 'Idempotency-Key': randomUUID() })
                    .body({
                        durationInMinutes: 1,
                        movieId: movie.id,
                        startTimes: [instant()],
                        theaterIds: [nullObjectId]
                    })
            })
            it('상영 생성을 요청하면 오류 상태를 전송한다', async () => {
                const {
                    response: { body },
                    completion
                } = await submitAndWaitForCompletion(fix, adminAccessToken, 'error', () =>
                    request.accepted({ schema: RequestShowtimeCreationResponseSchema })
                )

                expect(completion).toEqual({
                    message: 'One or more requested theaters could not be found.',
                    sagaId: body.sagaId,
                    status: 'error'
                })
            })
        })

        describe('요청한 상영 시간이 서로 겹치면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient
                    .post('/showtime-creation/showtimes')
                    .headers({ Authorization: `Bearer ${adminAccessToken}` })
                    .headers({ 'Idempotency-Key': randomUUID() })
                    .body({
                        durationInMinutes: 90,
                        movieId: movie.id,
                        startTimes: [instant('2100-01-01T09:00Z'), instant('2100-01-01T10:00Z')],
                        theaterIds: [theater.id]
                    })
            })
            it('상영 생성을 요청하면 400을 반환한다', async () => {
                await request.badRequest({
                    expected: Errors.ShowtimeCreation.OverlappingStartTimes(expect.any(Array))
                })
            })
        })

        describe('요청한 상영 시작 시각에 중복이 있으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                const start = instant('2100-01-01T09:00Z')
                request = fix.httpClient
                    .post('/showtime-creation/showtimes')
                    .headers({ Authorization: `Bearer ${adminAccessToken}` })
                    .headers({ 'Idempotency-Key': randomUUID() })
                    .body({
                        durationInMinutes: 1,
                        movieId: movie.id,
                        startTimes: [start, start],
                        theaterIds: [theater.id]
                    })
            })
            it('상영 생성을 요청하면 400을 반환한다', async () => {
                await request.badRequest({
                    expected: Errors.ShowtimeCreation.OverlappingStartTimes(expect.any(Array))
                })
            })
        })

        describe('요청한 극장 ID에 중복이 있으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient
                    .post('/showtime-creation/showtimes')
                    .headers({ Authorization: `Bearer ${adminAccessToken}` })
                    .headers({ 'Idempotency-Key': randomUUID() })
                    .body({ ...buildCreateDto(), theaterIds: [theater.id, theater.id] })
            })
            it('상영 생성을 요청하면 400을 반환한다', async () => {
                await request.badRequest({
                    expected: Errors.RequestValidation.Failed([
                        {
                            constraints: { validation: 'Duplicate theater IDs are not allowed' },
                            field: 'theaterIds'
                        }
                    ])
                })
            })
        })

        describe('극장 21개가 존재하면', () => {
            let theaters: TheaterDto[]
            beforeEach(async () => {
                theaters = await Promise.all(Array.from({ length: 20 }, () => createTheater(fix)))
            })
            it('극장마다 상영 한 건을 요청하면 21건을 생성한다', async () => {
                const {
                    response: { body },
                    completion
                } = await submitAndWaitForCompletion(fix, adminAccessToken, 'succeeded', () =>
                    fix.httpClient
                        .post('/showtime-creation/showtimes')
                        .headers({ Authorization: `Bearer ${adminAccessToken}` })
                        .headers({ 'Idempotency-Key': randomUUID() })
                        .body({
                            ...buildCreateDto(),
                            theaterIds: [theater.id, ...theaters.map(({ id }) => id)]
                        })
                        .accepted({ schema: RequestShowtimeCreationResponseSchema })
                )

                expect(completion).toEqual({
                    sagaId: body.sagaId,
                    status: 'succeeded',
                    createdShowtimeCount: 21,
                    createdTicketCount: expect.any(Number)
                })
                await expect(
                    showtimesService.search({ sagaIds: [body.sagaId] })
                ).resolves.toHaveLength(21)
            })
        })

        describe('티켓 저장 직후 예외가 발생하도록 설정하면', () => {
            let createShowtimesSpy: MockInstance
            let attemptedTicketCount: number

            beforeEach(async () => {
                attemptedTicketCount = 0
                createShowtimesSpy = vi.spyOn(showtimesService, 'createMany')

                // 실제 insert까지 실행한 다음 throw한다. transaction이 없으면 showtimes와 tickets가 남는다.
                const realCreateMany = ticketsService.createMany.bind(ticketsService)
                vi.spyOn(ticketsService, 'createMany').mockImplementation(
                    async (createDtos, session, signal) => {
                        await realCreateMany(createDtos, session, signal)
                        attemptedTicketCount += createDtos.length
                        throw new Error('ticket creation failed after insert')
                    }
                )
            })

            it('생성을 요청하면 네 번 시도한 뒤 실패하고 상영과 티켓을 모두 되돌린다', async () => {
                const {
                    response: { body }
                } = await submitAndWaitForCompletion(fix, adminAccessToken, 'error', () =>
                    fix.httpClient
                        .post('/showtime-creation/showtimes')
                        .headers({ Authorization: `Bearer ${adminAccessToken}` })
                        .headers({ 'Idempotency-Key': randomUUID() })
                        .body({
                            ...buildCreateDto(),
                            startTimes: [instant('2100-01-01T09:00Z'), instant('2100-01-01T11:00Z')]
                        })
                        .accepted({ schema: RequestShowtimeCreationResponseSchema })
                )
                const sagaId = body.sagaId
                expect(createShowtimesSpy).toHaveBeenCalledTimes(4)
                expect(attemptedTicketCount).toBeGreaterThan(0)
                const showtimes = await showtimesService.search({ sagaIds: [sagaId] })
                const tickets = await ticketsService.search({ sagaIds: [sagaId] })
                expect(showtimes).toEqual([])
                expect(tickets).toEqual([])
            })
        })

        describe('티켓의 첫 저장이 실패하도록 설정하면', () => {
            beforeEach(() => {
                vi.spyOn(ticketsService, 'createMany').mockRejectedValueOnce(
                    new Error('transient ticket write failure')
                )
            })
            it('상영 생성을 요청하면 재시도하여 상영과 티켓을 중복 없이 생성한다', async () => {
                const {
                    response: { body },
                    completion
                } = await submitAndWaitForCompletion(fix, adminAccessToken, 'succeeded', () =>
                    fix.httpClient
                        .post('/showtime-creation/showtimes')
                        .headers({ Authorization: `Bearer ${adminAccessToken}` })
                        .headers({ 'Idempotency-Key': randomUUID() })
                        .body(buildCreateDto())
                        .accepted({ schema: RequestShowtimeCreationResponseSchema })
                )

                const showtimes = await showtimesService.search({ sagaIds: [body.sagaId] })
                const tickets = await ticketsService.search({ sagaIds: [body.sagaId] })
                expect(showtimes).toHaveLength(completion.createdShowtimeCount)
                expect(tickets).toHaveLength(completion.createdTicketCount)
            })
        })

        describe('상영 저장이 지연되고 저장 완료 응답이 유실되도록 설정하면', () => {
            let persistenceSpy: MockInstance<
                ShowtimeCreationPersistenceService['validateAndCreate']
            >
            let createShowtimesSpy: MockInstance<ShowtimesService['createMany']>
            beforeEach(async () => {
                const realValidateAndCreate = persistence.validateAndCreate.bind(persistence)
                persistenceSpy = vi
                    .spyOn(persistence, 'validateAndCreate')
                    .mockImplementationOnce(async (...args) => {
                        await sleep(5_100)
                        await realValidateAndCreate(...args)
                        throw new Error('durable step completion response lost after commit')
                    })
                createShowtimesSpy = vi.spyOn(showtimesService, 'createMany')
            })
            it('생성 요청은 저장을 재호출해도 상영과 티켓을 한 번만 생성한다', async () => {
                const {
                    response: { body },
                    completion
                } = await submitAndWaitForCompletion(fix, adminAccessToken, 'succeeded', () =>
                    fix.httpClient
                        .post('/showtime-creation/showtimes')
                        .headers({ Authorization: `Bearer ${adminAccessToken}` })
                        .headers({ 'Idempotency-Key': randomUUID() })
                        .body(buildCreateDto())
                        .accepted({ schema: RequestShowtimeCreationResponseSchema })
                )

                expect(persistenceSpy).toHaveBeenCalledTimes(2)
                expect(createShowtimesSpy).toHaveBeenCalledTimes(1)
                const showtimes = await showtimesService.search({ sagaIds: [body.sagaId] })
                const tickets = await ticketsService.search({ sagaIds: [body.sagaId] })
                expect(showtimes).toHaveLength(completion.createdShowtimeCount)
                expect(tickets).toHaveLength(completion.createdTicketCount)
            })
        })

        describe('12시·14시·16시 30분·18시 30분에 시작하는 상영이 존재하면', () => {
            let initialShowtimes: Awaited<ReturnType<typeof createShowtimes>>
            beforeEach(async () => {
                initialShowtimes = await createShowtimes(
                    fix,
                    [
                        instant('2013-01-31T12:00Z'),
                        instant('2013-01-31T14:00Z'),
                        instant('2013-01-31T16:30Z'),
                        instant('2013-01-31T18:30Z')
                    ].map((startTime) => ({
                        endTime: DateUtil.add({ base: startTime, minutes: 90 }),
                        startTime,
                        theaterId: theater.id
                    }))
                )
            })
            it('기존 상영과 겹치는 시각으로 요청하면 실패를 알리고 끝 시각만 맞닿는 상영은 충돌에서 제외한다', async () => {
                const { completion } = await submitAndWaitForCompletion(
                    fix,
                    adminAccessToken,
                    'failed',
                    () =>
                        fix.httpClient
                            .post('/showtime-creation/showtimes')
                            .headers({ Authorization: `Bearer ${adminAccessToken}` })
                            .headers({ 'Idempotency-Key': randomUUID() })
                            .body({
                                durationInMinutes: 30,
                                movieId: movie.id,
                                startTimes: [
                                    instant('2013-01-31T12:00Z'),
                                    instant('2013-01-31T16:00Z'),
                                    instant('2013-01-31T20:00Z')
                                ],
                                theaterIds: [theater.id]
                            })
                            .accepted({ schema: RequestShowtimeCreationResponseSchema })
                )

                // 새 12:00-12:30은 기존 12:00-13:30과 시간이 겹치므로 충돌이다.
                // 새 16:00-16:30과 기존 16:30-18:00, 새 20:00-20:30과 기존 18:30-20:00은 한 상영이 끝나는 시각에 다른 상영이 시작한다.
                // 끝 시각을 포함하지 않는 정책이라 충돌로 보지 않는다.
                const conflictingShowtimes = [initialShowtimes[0]]

                expect(completion).toEqual({
                    conflictingShowtimes,
                    sagaId: expect.any(String),
                    status: 'failed'
                })
            })
        })

        describe('12시부터 13시 30분까지 상영이 존재하면', () => {
            let initialShowtime: Awaited<ReturnType<typeof createShowtimes>>[number] | undefined
            beforeEach(async () => {
                ;[initialShowtime] = await createShowtimes(fix, [
                    {
                        endTime: instant('2013-01-31T13:30Z'),
                        startTime: instant('2013-01-31T12:00Z'),
                        theaterId: theater.id
                    }
                ])
            })
            it('기존 상영과 겹치는 세 시각으로 생성을 요청해도 충돌 목록에는 한 건만 담는다', async () => {
                const { completion } = await submitAndWaitForCompletion(
                    fix,
                    adminAccessToken,
                    'failed',
                    () =>
                        fix.httpClient
                            .post('/showtime-creation/showtimes')
                            .headers({ Authorization: `Bearer ${adminAccessToken}` })
                            .headers({ 'Idempotency-Key': randomUUID() })
                            .body({
                                durationInMinutes: 10,
                                movieId: movie.id,
                                startTimes: [
                                    instant('2013-01-31T12:00Z'),
                                    instant('2013-01-31T12:30Z'),
                                    instant('2013-01-31T13:00Z')
                                ],
                                theaterIds: [theater.id]
                            })
                            .accepted({ schema: RequestShowtimeCreationResponseSchema })
                )

                expect(completion).toEqual({
                    conflictingShowtimes: [initialShowtime],
                    sagaId: expect.any(String),
                    status: 'failed'
                })
            })

            describe('상영이 없는 다른 극장도 존재하면', () => {
                let theaterB: TheaterDto
                beforeEach(async () => {
                    theaterB = await createTheater(fix)
                })
                it('한 극장만 시간이 겹쳐도 요청한 모든 극장에 새 상영을 만들지 않는다', async () => {
                    const createDto = {
                        durationInMinutes: 90,
                        movieId: movie.id,
                        startTimes: [instant('2013-01-31T12:00Z')],
                        theaterIds: [theater.id, theaterB.id]
                    }
                    const {
                        response: { body },
                        completion
                    } = await submitAndWaitForCompletion(fix, adminAccessToken, 'failed', () =>
                        fix.httpClient
                            .post('/showtime-creation/showtimes')
                            .headers({ Authorization: `Bearer ${adminAccessToken}` })
                            .headers({ 'Idempotency-Key': randomUUID() })
                            .body(createDto)
                            .accepted({ schema: RequestShowtimeCreationResponseSchema })
                    )

                    expect(completion).toEqual({
                        conflictingShowtimes: [initialShowtime],
                        sagaId: body.sagaId,
                        status: 'failed'
                    })

                    // 검증 전체 통과 후에만 생성하므로, 충돌이 없던 두 번째 극장의 몫도 만들어지지 않아야 한다.
                    const showtimes = await showtimesService.search({ sagaIds: [body.sagaId] })
                    expect(showtimes).toEqual([])

                    const tickets = await ticketsService.search({ sagaIds: [body.sagaId] })
                    expect(tickets).toEqual([])

                    const replay = await persistence.validateAndCreate(createDto, body.sagaId)
                    if (replay.kind !== 'failed')
                        throw new Error('failed operation was not restored')
                    expect(replay.conflictingShowtimes[0]?.startTime).toBeInstanceOf(
                        Temporal.Instant
                    )
                    expect(replay.conflictingShowtimes[0]?.endTime).toBeInstanceOf(Temporal.Instant)
                })
            })
        })

        describe('10시부터 12시까지 상영이 존재하면', () => {
            let initialShowtime: Awaited<ReturnType<typeof createShowtimes>>[number] | undefined
            beforeEach(async () => {
                ;[initialShowtime] = await createShowtimes(fix, [
                    {
                        endTime: instant('2013-01-31T12:00Z'),
                        startTime: instant('2013-01-31T10:00Z'),
                        theaterId: theater.id
                    }
                ])
            })
            it('10시 5분에 시작하는 상영 생성을 요청하면 시간 충돌을 알린다', async () => {
                const { completion } = await submitAndWaitForCompletion(
                    fix,
                    adminAccessToken,
                    'failed',
                    () =>
                        fix.httpClient
                            .post('/showtime-creation/showtimes')
                            .headers({ Authorization: `Bearer ${adminAccessToken}` })
                            .headers({ 'Idempotency-Key': randomUUID() })
                            .body({
                                durationInMinutes: 60,
                                movieId: movie.id,
                                startTimes: [instant('2013-01-31T10:05Z')],
                                theaterIds: [theater.id]
                            })
                            .accepted({ schema: RequestShowtimeCreationResponseSchema })
                )

                expect(completion).toEqual({
                    conflictingShowtimes: [initialShowtime],
                    sagaId: expect.any(String),
                    status: 'failed'
                })
            })
        })

        describe('9시부터 11시까지 상영이 존재하면', () => {
            let initialShowtime: Awaited<ReturnType<typeof createShowtimes>>[number] | undefined
            beforeEach(async () => {
                ;[initialShowtime] = await createShowtimes(fix, [
                    {
                        endTime: instant('2013-01-31T11:00Z'),
                        startTime: instant('2013-01-31T09:00Z'),
                        theaterId: theater.id
                    }
                ])
            })
            it('10시에 시작하는 상영 생성을 요청하면 기존 상영과의 충돌을 알린다', async () => {
                const { completion } = await submitAndWaitForCompletion(
                    fix,
                    adminAccessToken,
                    'failed',
                    () =>
                        fix.httpClient
                            .post('/showtime-creation/showtimes')
                            .headers({ Authorization: `Bearer ${adminAccessToken}` })
                            .headers({ 'Idempotency-Key': randomUUID() })
                            .body({
                                durationInMinutes: 120,
                                movieId: movie.id,
                                startTimes: [instant('2013-01-31T10:00Z')],
                                theaterIds: [theater.id]
                            })
                            .accepted({ schema: RequestShowtimeCreationResponseSchema })
                )

                expect(completion).toEqual({
                    conflictingShowtimes: [initialShowtime],
                    sagaId: expect.any(String),
                    status: 'failed'
                })
            })
        })
    })

    describe('ShowtimeCreationPersistenceService.validateAndCreate', () => {
        describe('상영 생성을 완료한 작업이 존재하면', () => {
            let sagaId: string
            let createDto: ReturnType<typeof buildCreateDto>
            let first: Awaited<ReturnType<ShowtimeCreationPersistenceService['validateAndCreate']>>
            beforeEach(async () => {
                sagaId = newObjectIdString()
                createDto = buildCreateDto()

                first = await persistence.validateAndCreate(createDto, sagaId)
            })
            it('같은 작업 ID로 다시 실행하면 상영과 티켓을 중복 생성하지 않는다', async () => {
                const second = await persistence.validateAndCreate(createDto, sagaId)

                expect(second).toEqual(first)
                expect(first.kind).toBe('succeeded')
                const showtimes = await showtimesService.search({ sagaIds: [sagaId] })
                const tickets = await ticketsService.search({ sagaIds: [sagaId] })
                if (first.kind === 'succeeded') {
                    expect(showtimes).toHaveLength(first.createdShowtimeCount)
                    expect(tickets).toHaveLength(first.createdTicketCount)
                }
            })

            it('완료된 작업 ID를 다른 생성 조건에 재사용하면 거부한다', async () => {
                await expect(
                    persistence.validateAndCreate(
                        { ...createDto, startTimes: [instant('2100-01-01T11:00Z')] },
                        sagaId
                    )
                ).rejects.toThrow(
                    expect.objectContaining({
                        status: 500,
                        cause: `Saga ID was reused with different input (sagaId=${sagaId})`
                    })
                )
            })
        })

        describe('요청한 상영 수가 한 번에 생성할 수 있는 상한을 넘으면', () => {
            let createDto: Parameters<typeof persistence.validateAndCreate>[0]
            beforeEach(() => {
                createDto = {
                    ...buildCreateDto(),
                    startTimes: Array.from({ length: 15 }, (_, index) =>
                        instant(Date.UTC(2100, 0, 1, index))
                    ),
                    theaterIds: Array.from({ length: 15 }, () => newObjectIdString())
                }
            })
            it('상영을 생성하면 수량 초과 예외를 던진다', async () => {
                await expect(
                    persistence.validateAndCreate(createDto, newObjectIdString())
                ).rejects.toMatchObject({
                    response: { code: 'ERR_SHOWTIME_CREATION_TOO_MANY_SHOWTIMES', maximum: 200 }
                })
            })
        })
        describe('좌석이 10,001개인 극장이 존재하면', () => {
            let largeTheater: TheaterDto
            beforeEach(async () => {
                largeTheater = await createTheater(fix, {
                    seatmap: {
                        blocks: [{ name: 'A', rows: [{ name: '1', layout: 'O'.repeat(10_001) }] }]
                    }
                })
            })
            it('상영 생성을 요청하면 티켓 수 초과 예외를 던지고 상영 저장도 되돌린다', async () => {
                const sagaId = newObjectIdString()

                await expect(
                    persistence.validateAndCreate(
                        { ...buildCreateDto(), theaterIds: [largeTheater.id] },
                        sagaId
                    )
                ).rejects.toMatchObject({
                    response: { code: 'ERR_SHOWTIME_CREATION_TOO_MANY_TICKETS', maximum: 10_000 }
                })
                await expect(showtimesService.search({ sagaIds: [sagaId] })).resolves.toEqual([])
            })
        })
        it('같은 작업 ID로 동시에 실행해도 상영과 티켓이 중복으로 저장되지 않는다', async () => {
            const sagaId = newObjectIdString()
            const createDto = buildCreateDto()

            const [first, second] = await Promise.all([
                persistence.validateAndCreate(createDto, sagaId),
                persistence.validateAndCreate(createDto, sagaId)
            ])

            expect(first.kind).toBe('succeeded')
            expect(second).toEqual(first)
            const showtimes = await showtimesService.search({ sagaIds: [sagaId] })
            const tickets = await ticketsService.search({ sagaIds: [sagaId] })
            if (first.kind === 'succeeded') {
                expect(showtimes).toHaveLength(first.createdShowtimeCount)
                expect(tickets).toHaveLength(first.createdTicketCount)
            }
        })
        it('같은 극장의 겹치는 상영을 동시에 생성하면 한 요청만 성공한다', async () => {
            const createDto = buildCreateDto()
            const sagaIds = [newObjectIdString(), newObjectIdString()]

            const results = await Promise.all(
                sagaIds.map((sagaId) => persistence.validateAndCreate(createDto, sagaId))
            )

            expect(results.map((result) => result.kind).sort()).toEqual(['failed', 'succeeded'])
            const showtimes = await showtimesService.search({ sagaIds })
            expect(showtimes).toHaveLength(1)
        })
    })

    describe('ShowtimeCreationSubmissionRepository.acquire', () => {
        describe('처리 권한을 반납한 접수 기록이 존재하면', () => {
            let submissions: ShowtimeCreationSubmissionRepository
            let principalId: string
            let idempotencyKey: string
            let inputHash: string
            let didBothRead: Promise<void>
            let continueClaims: () => void
            beforeEach(async () => {
                submissions = fix.module.get(ShowtimeCreationSubmissionRepository)
                principalId = randomUUID()
                idempotencyKey = randomUUID()
                inputHash = randomUUID()
                const initial = await submissions.acquire(
                    principalId,
                    idempotencyKey,
                    inputHash,
                    DateUtil.now(),
                    DateUtil.add({ minutes: 1 })
                )
                if (initial.kind !== 'acquired') throw new Error('initial claim was not acquired')
                await submissions.release(principalId, idempotencyKey, initial.claimId)

                const findByIdempotencyKey = submissions.findByIdempotencyKey.bind(submissions)
                let staleReadCount = 0
                let bothRead!: () => void
                didBothRead = new Promise<void>((resolve) => {
                    bothRead = resolve
                })
                const mayContinueClaims = new Promise<void>((resolve) => {
                    continueClaims = resolve
                })
                vi.spyOn(submissions, 'findByIdempotencyKey').mockImplementation(
                    async (...args) => {
                        const stale = await findByIdempotencyKey(...args)
                        staleReadCount += 1
                        if (staleReadCount === 2) bothRead()
                        await mayContinueClaims
                        return stale
                    }
                )
            })
            it('두 호출이 같은 기록을 읽고 다시 획득하려 하면 하나만 성공한다', async () => {
                const now = DateUtil.now()
                const claimUntil = DateUtil.add({ base: now, minutes: 1 })
                const claims = Promise.all([
                    submissions.acquire(principalId, idempotencyKey, inputHash, now, claimUntil),
                    submissions.acquire(principalId, idempotencyKey, inputHash, now, claimUntil)
                ])
                await didBothRead
                continueClaims()

                expect((await claims).map((claim) => claim.kind).sort()).toEqual([
                    'acquired',
                    'in-progress'
                ])
            })
        })
    })
})
