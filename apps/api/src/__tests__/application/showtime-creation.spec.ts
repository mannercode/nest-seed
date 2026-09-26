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
        it('쿼리가 없으면 전체 영화 페이지를 반환한다', async () => {
            await fix.httpClient
                .get('/showtime-creation/movies')
                .headers({ Authorization: `Bearer ${adminAccessToken}` })
                .ok({
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

    describe('GET /showtime-creation/theaters', () => {
        it('쿼리가 없으면 전체 극장 페이지를 반환한다', async () => {
            await fix.httpClient
                .get('/showtime-creation/theaters')
                .headers({ Authorization: `Bearer ${adminAccessToken}` })
                .ok({
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

    describe('POST /showtime-creation/showtimes/search', () => {
        it('극장 ID 목록으로 상영 시간을 조회한다', async () => {
            const showtimes = await createShowtimes(
                fix,
                [
                    instant('2100-01-01T09:00Z'),
                    instant('2100-01-01T11:00Z'),
                    instant('2100-01-01T13:00Z')
                ].map((startTime) => ({ startTime, theaterId: theater.id }))
            )

            const response = await fix.httpClient
                .post('/showtime-creation/showtimes/search')
                .headers({ Authorization: `Bearer ${adminAccessToken}` })
                .body({ theaterIds: [theater.id] })
                .ok({ schema: ShowtimeSchema.array(), expected: expect.arrayContaining(showtimes) })

            expect(response.text).toContain('"startTime":"2100-01-01T09:00:00.000Z"')
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
            beforeEach(() => {
                if (failNotification) {
                    vi.spyOn(
                        fix.module.get(ShowtimeCreationEventService),
                        'emitStatusChanged'
                    ).mockRejectedValue(new Error('NATS unavailable'))
                }
            })

            it('SSE를 구독하지 않아도 완료 상태를 조회한다', async () => {
                const created = await fix.httpClient
                    .post('/showtime-creation/showtimes')
                    .headers({ Authorization: `Bearer ${adminAccessToken}` })
                    .headers({ 'Idempotency-Key': randomUUID() })
                    .body(buildCreateDto())
                    .accepted({ schema: RequestShowtimeCreationResponseSchema })
                const sagaId = created.body.sagaId
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

        it('요청한 관리자에게 접수 기록이 없는 작업이면 404를 반환한다', async () => {
            await fix.httpClient
                .get(`/showtime-creation/showtimes/${nullObjectId}/status`)
                .headers({ Authorization: `Bearer ${adminAccessToken}` })
                .notFound({ expected: Errors.ShowtimeCreation.SagaNotFound(nullObjectId) })
        })
    })

    describe('POST /showtime-creation/showtimes', () => {
        it('Idempotency-Key가 없으면 400을 반환한다', async () => {
            await fix.httpClient
                .post('/showtime-creation/showtimes')
                .headers({ Authorization: `Bearer ${adminAccessToken}` })
                .body(buildCreateDto())
                .badRequest({ expected: Errors.Idempotency.KeyRequired() })
        })

        it('Idempotency-Key 형식이 잘못되면 400을 반환한다', async () => {
            await fix.httpClient
                .post('/showtime-creation/showtimes')
                .headers({ Authorization: `Bearer ${adminAccessToken}` })
                .headers({ 'Idempotency-Key': 'short' })
                .body(buildCreateDto())
                .badRequest({ expected: Errors.Idempotency.KeyInvalid() })
        })

        it('같은 키와 본문으로 다시 요청하면 최초 작업 ID를 반환한다', async () => {
            const idempotencyKey = randomUUID()
            const createDto = buildCreateDto()

            const first = await fix.httpClient
                .post('/showtime-creation/showtimes')
                .headers({ Authorization: `Bearer ${adminAccessToken}` })
                .headers({ 'Idempotency-Key': idempotencyKey })
                .body(createDto)
                .accepted({ schema: RequestShowtimeCreationResponseSchema })
            const replay = await fix.httpClient
                .post('/showtime-creation/showtimes')
                .headers({ Authorization: `Bearer ${adminAccessToken}` })
                .headers({ 'Idempotency-Key': idempotencyKey })
                .body(createDto)
                .accepted({ schema: RequestShowtimeCreationResponseSchema })

            expect(replay.body).toEqual(first.body)
        })

        it('같은 키를 다른 요청 본문에 재사용하면 409를 반환한다', async () => {
            const idempotencyKey = randomUUID()
            const createDto = buildCreateDto()

            await fix.httpClient
                .post('/showtime-creation/showtimes')
                .headers({ Authorization: `Bearer ${adminAccessToken}` })
                .headers({ 'Idempotency-Key': idempotencyKey })
                .body(createDto)
                .accepted({ schema: RequestShowtimeCreationResponseSchema })

            await fix.httpClient
                .post('/showtime-creation/showtimes')
                .headers({ Authorization: `Bearer ${adminAccessToken}` })
                .headers({ 'Idempotency-Key': idempotencyKey })
                .body({ ...createDto, durationInMinutes: createDto.durationInMinutes + 1 })
                .conflict({ expected: Errors.Idempotency.KeyReused() })
        })

        it('같은 키의 최초 요청을 처리 중이면 409를 반환한다', async () => {
            const workflow = fix.module.get(ShowtimeCreationWorkflowClient)
            const submitWorkflow = workflow.submit.bind(workflow)
            let workflowStartEntered!: () => void
            const didEnterWorkflowStart = new Promise<void>((resolve) => {
                workflowStartEntered = resolve
            })
            let continueWorkflowStart!: () => void
            const mayContinueWorkflowStart = new Promise<void>((resolve) => {
                continueWorkflowStart = resolve
            })
            vi.spyOn(workflow, 'submit').mockImplementationOnce(async (...args) => {
                workflowStartEntered()
                await mayContinueWorkflowStart
                return submitWorkflow(...args)
            })

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

        it('Restate 제출에 실패해도 같은 키로 재요청하면 기존 작업을 다시 제출한다', async () => {
            const workflow = fix.module.get(ShowtimeCreationWorkflowClient)
            const submitWorkflow = vi
                .spyOn(workflow, 'submit')
                .mockRejectedValueOnce(new Error('Restate unavailable before workflow submission'))
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

        it('작업 제출 후 접수 완료 저장이 실패해도 같은 작업으로 재접수한다', async () => {
            const events = fix.module.get(ShowtimeCreationEventService)
            const workflow = fix.module.get(ShowtimeCreationWorkflowClient)
            const submissions = fix.module.get(ShowtimeCreationSubmissionRepository)
            const emitStatusChanged = vi.spyOn(events, 'emitStatusChanged')
            const submitWorkflow = vi.spyOn(workflow, 'submit')
            const markAccepted = vi
                .spyOn(submissions, 'markAccepted')
                .mockRejectedValueOnce(new Error('accepted marker write failed'))
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

        it('접수 완료 기록 전에 처리 권한을 잃어도 같은 키로 재접수할 수 있다', async () => {
            const submissions = fix.module.get(ShowtimeCreationSubmissionRepository)
            const markAccepted = vi.spyOn(submissions, 'markAccepted').mockResolvedValueOnce(null)
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

        it('접수 기록을 저장하지 못하면 상영 생성 작업을 시작하지 않는다', async () => {
            const workflow = fix.module.get(ShowtimeCreationWorkflowClient)
            const submissions = fix.module.get(ShowtimeCreationSubmissionRepository)
            const submitWorkflow = vi.spyOn(workflow, 'submit')
            vi.spyOn(submissions.collection, 'insertOne').mockRejectedValueOnce(
                new Error('submission storage unavailable')
            )

            await fix.httpClient
                .post('/showtime-creation/showtimes')
                .headers({ Authorization: `Bearer ${adminAccessToken}` })
                .headers({ 'Idempotency-Key': randomUUID() })
                .body(buildCreateDto())
                .internalServerError()

            expect(submitWorkflow).not.toHaveBeenCalled()
        })

        it('처리 권한이 풀린 접수를 동시에 다시 맡으려 하면 하나만 성공한다', async () => {
            const submissions = fix.module.get(ShowtimeCreationSubmissionRepository)
            const principalId = randomUUID()
            const idempotencyKey = randomUUID()
            const inputHash = randomUUID()
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
            const didBothRead = new Promise<void>((resolve) => {
                bothRead = resolve
            })
            let continueClaims!: () => void
            const mayContinueClaims = new Promise<void>((resolve) => {
                continueClaims = resolve
            })
            vi.spyOn(submissions, 'findByIdempotencyKey').mockImplementation(async (...args) => {
                const stale = await findByIdempotencyKey(...args)
                staleReadCount += 1
                if (staleReadCount === 2) bothRead()
                await mayContinueClaims
                return stale
            })

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

        it('입력 검증에 실패하면 수정한 요청을 같은 키로 다시 보낼 수 있다', async () => {
            const idempotencyKey = randomUUID()
            const createDto = buildCreateDto()

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

            await fix.httpClient
                .post('/showtime-creation/showtimes')
                .headers({ Authorization: `Bearer ${adminAccessToken}` })
                .headers({ 'Idempotency-Key': idempotencyKey })
                .body(createDto)
                .accepted({ schema: RequestShowtimeCreationResponseSchema })
        })

        describe('정상 요청 흐름', () => {
            const create = () =>
                submitAndWaitForCompletion(fix, adminAccessToken, 'succeeded', () =>
                    fix.httpClient
                        .post('/showtime-creation/showtimes')
                        .headers({ Authorization: `Bearer ${adminAccessToken}` })
                        .headers({ 'Idempotency-Key': randomUUID() })
                        .body(buildCreateDto())
                        .accepted({ schema: RequestShowtimeCreationResponseSchema })
                )
            let result: Awaited<ReturnType<typeof create>>

            beforeEach(async () => {
                result = await create()
            })

            it('상영 생성 작업 ID를 반환한다', () => {
                expect(result.response.body).toEqual(
                    expect.objectContaining({ sagaId: expect.any(String) })
                )
            })

            it('SSE로 상영 생성 상태를 전달한다', () => {
                expect(result.completion).toEqual(
                    expect.objectContaining({
                        sagaId: result.response.body.sagaId,
                        status: 'succeeded'
                    })
                )
            })

            it('상영 시간을 생성한다', async () => {
                const createdShowtimes = await showtimesService.search({
                    sagaIds: [result.response.body.sagaId]
                })
                expect(result.completion.createdShowtimeCount).toBe(1)
                expect(createdShowtimes).toHaveLength(1)
            })

            it('티켓을 생성한다', async () => {
                const createdTickets = await ticketsService.search({
                    sagaIds: [result.response.body.sagaId]
                })
                // 기본 극장의 OOOOXXOOOO 배치는 판매 좌석이 8개다.
                expect(result.completion.createdTicketCount).toBe(8)
                expect(createdTickets).toHaveLength(8)
            })
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

        it('영화가 없으면 오류 상태를 전송한다', async () => {
            const {
                response: { body },
                completion
            } = await submitAndWaitForCompletion(fix, adminAccessToken, 'error', () =>
                fix.httpClient
                    .post('/showtime-creation/showtimes')
                    .headers({ Authorization: `Bearer ${adminAccessToken}` })
                    .headers({ 'Idempotency-Key': randomUUID() })
                    .body({
                        durationInMinutes: 1,
                        movieId: nullObjectId,
                        startTimes: [instant()],
                        theaterIds: [theater.id]
                    })
                    .accepted({ schema: RequestShowtimeCreationResponseSchema })
            )

            expect(completion).toEqual({
                message: 'The requested movie could not be found.',
                sagaId: body.sagaId,
                status: 'error'
            })
        })

        it('극장이 없으면 오류 상태를 전송한다', async () => {
            const {
                response: { body },
                completion
            } = await submitAndWaitForCompletion(fix, adminAccessToken, 'error', () =>
                fix.httpClient
                    .post('/showtime-creation/showtimes')
                    .headers({ Authorization: `Bearer ${adminAccessToken}` })
                    .headers({ 'Idempotency-Key': randomUUID() })
                    .body({
                        durationInMinutes: 1,
                        movieId: movie.id,
                        startTimes: [instant()],
                        theaterIds: [nullObjectId]
                    })
                    .accepted({ schema: RequestShowtimeCreationResponseSchema })
            )

            expect(completion).toEqual({
                message: 'One or more requested theaters could not be found.',
                sagaId: body.sagaId,
                status: 'error'
            })
        })

        it('요청 안의 시작 시각이 서로 겹치면 사가를 시작하지 않고 400을 반환한다', async () => {
            await fix.httpClient
                .post('/showtime-creation/showtimes')
                .headers({ Authorization: `Bearer ${adminAccessToken}` })
                .headers({ 'Idempotency-Key': randomUUID() })
                .body({
                    durationInMinutes: 90,
                    movieId: movie.id,
                    startTimes: [instant('2100-01-01T09:00Z'), instant('2100-01-01T10:00Z')],
                    theaterIds: [theater.id]
                })
                .badRequest({
                    expected: Errors.ShowtimeCreation.OverlappingStartTimes(expect.any(Array))
                })
        })

        it('같은 시작 시각이 중복되어도 400을 반환한다', async () => {
            const start = instant('2100-01-01T09:00Z')

            await fix.httpClient
                .post('/showtime-creation/showtimes')
                .headers({ Authorization: `Bearer ${adminAccessToken}` })
                .headers({ 'Idempotency-Key': randomUUID() })
                .body({
                    durationInMinutes: 1,
                    movieId: movie.id,
                    startTimes: [start, start],
                    theaterIds: [theater.id]
                })
                .badRequest({
                    expected: Errors.ShowtimeCreation.OverlappingStartTimes(expect.any(Array))
                })
        })

        it('같은 극장 ID가 중복되면 400을 반환한다', async () => {
            await fix.httpClient
                .post('/showtime-creation/showtimes')
                .headers({ Authorization: `Bearer ${adminAccessToken}` })
                .headers({ 'Idempotency-Key': randomUUID() })
                .body({ ...buildCreateDto(), theaterIds: [theater.id, theater.id] })
                .badRequest({
                    expected: Errors.RequestValidation.Failed([
                        {
                            constraints: { validation: 'Duplicate theater IDs are not allowed' },
                            field: 'theaterIds'
                        }
                    ])
                })
        })

        it('극장이 20개를 넘어도 전체 상영 수가 상한 이하면 생성한다', async () => {
            const theaters = await Promise.all(Array.from({ length: 20 }, () => createTheater(fix)))

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
            await expect(showtimesService.search({ sagaIds: [body.sagaId] })).resolves.toHaveLength(
                21
            )
        })

        describe('트랜잭션 안에서 티켓을 저장한 뒤 실패하면', () => {
            let sagaId: string
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
                sagaId = body.sagaId
            })

            it('상영 생성을 정해진 횟수만큼 재시도한다', () => {
                expect(createShowtimesSpy).toHaveBeenCalledTimes(4)
                expect(attemptedTicketCount).toBeGreaterThan(0)
            })

            it('저장한 상영과 티켓을 모두 되돌린다', async () => {
                const showtimes = await showtimesService.search({ sagaIds: [sagaId] })
                const tickets = await ticketsService.search({ sagaIds: [sagaId] })
                expect(showtimes).toEqual([])
                expect(tickets).toEqual([])
            })
        })

        it('티켓 저장이 한 번 실패해도 재시도하여 상영과 티켓을 중복 없이 생성한다', async () => {
            vi.spyOn(ticketsService, 'createMany').mockRejectedValueOnce(
                new Error('transient ticket write failure')
            )

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

        it('저장 완료 응답을 잃어도 상영과 티켓을 다시 만들지 않고 기존 결과를 반환한다', async () => {
            const realValidateAndCreate = persistence.validateAndCreate.bind(persistence)
            const persistenceSpy = vi
                .spyOn(persistence, 'validateAndCreate')
                .mockImplementationOnce(async (...args) => {
                    await sleep(5_100)
                    await realValidateAndCreate(...args)
                    throw new Error('durable step completion response lost after commit')
                })
            const createShowtimesSpy = vi.spyOn(showtimesService, 'createMany')

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

        it('같은 작업 ID로 다시 실행하면 상영과 티켓을 중복 생성하지 않는다', async () => {
            const sagaId = newObjectIdString()
            const createDto = buildCreateDto()

            const first = await persistence.validateAndCreate(createDto, sagaId)
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
            const sagaId = newObjectIdString()
            const createDto = buildCreateDto()
            await persistence.validateAndCreate(createDto, sagaId)

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

        it('한 번에 생성할 상영 수가 상한을 넘으면 저장 전에 거부한다', async () => {
            const createDto = {
                ...buildCreateDto(),
                startTimes: Array.from({ length: 15 }, (_, index) =>
                    instant(Date.UTC(2100, 0, 1, index))
                ),
                theaterIds: Array.from({ length: 15 }, () => newObjectIdString())
            }

            await expect(
                persistence.validateAndCreate(createDto, newObjectIdString())
            ).rejects.toMatchObject({
                response: { code: 'ERR_SHOWTIME_CREATION_TOO_MANY_SHOWTIMES', maximum: 200 }
            })
        })

        it('생성할 티켓 수가 상한을 넘으면 이미 저장한 상영도 되돌린다', async () => {
            const largeTheater = await createTheater(fix, {
                seatmap: {
                    blocks: [{ name: 'A', rows: [{ name: '1', layout: 'O'.repeat(10_001) }] }]
                }
            })
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

        it('기존 상영 시간과 겹치면 충돌 목록과 함께 실패 상태를 전송한다', async () => {
            const initialShowtimes = await createShowtimes(
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

        it('한 극장만 시간이 겹쳐도 요청한 모든 극장에 새 상영을 만들지 않는다', async () => {
            // 첫 극장에만 겹치는 기존 상영을 두고, 충돌 없는 두 번째 극장을 같은 사가로 묶는다.
            const theaterB = await createTheater(fix)
            const [conflictingShowtime] = await createShowtimes(fix, [
                {
                    endTime: instant('2013-01-31T13:30Z'),
                    startTime: instant('2013-01-31T12:00Z'),
                    theaterId: theater.id
                }
            ])

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
                conflictingShowtimes: [conflictingShowtime],
                sagaId: body.sagaId,
                status: 'failed'
            })

            // 검증 전체 통과 후에만 생성하므로, 충돌이 없던 두 번째 극장의 몫도 만들어지지 않아야 한다.
            const showtimes = await showtimesService.search({ sagaIds: [body.sagaId] })
            expect(showtimes).toEqual([])

            const tickets = await ticketsService.search({ sagaIds: [body.sagaId] })
            expect(tickets).toEqual([])

            const replay = await persistence.validateAndCreate(createDto, body.sagaId)
            if (replay.kind !== 'failed') throw new Error('failed operation was not restored')
            expect(replay.conflictingShowtimes[0]?.startTime).toBeInstanceOf(Temporal.Instant)
            expect(replay.conflictingShowtimes[0]?.endTime).toBeInstanceOf(Temporal.Instant)
        })

        it('한 기존 상영 시간이 여러 새 시작 시각과 겹쳐도 결과에는 한 번만 들어간다', async () => {
            // 기존 12:00-13:30(90분) 하나가 새 12:00, 12:30, 13:00 세 시작 시각 모두의 첫 슬롯에 걸린다.
            // 중복 제거가 빠지면 같은 상영이 세 번 결과에 들어간다.
            const [initialShowtime] = await createShowtimes(fix, [
                {
                    endTime: instant('2013-01-31T13:30Z'),
                    startTime: instant('2013-01-31T12:00Z'),
                    theaterId: theater.id
                }
            ])

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

        it('시작 분이 10분 단위로 정렬되지 않은 새 상영도 겹치면 충돌로 보고한다', async () => {
            // 기존 10:00-12:00과 새 10:05-11:05는 55분이 겹친다.
            // 슬롯 격자로 비교하면 시작 분이 다를 때 키 교집합이 비어 충돌을 놓친다.
            const [initialShowtime] = await createShowtimes(fix, [
                {
                    endTime: instant('2013-01-31T12:00Z'),
                    startTime: instant('2013-01-31T10:00Z'),
                    theaterId: theater.id
                }
            ])

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

        it('기존 상영 시간이 새 범위보다 먼저 시작했어도 끝이 겹치면 충돌로 보고한다', async () => {
            // 기존 09:00-11:00은 새 요청의 시작 시각(10:00)보다 일찍 시작했다.
            // 시작 시각만 보면 새 범위 바깥이지만, 끝 시각이 새 범위와 겹치므로 충돌로 봐야 한다.
            const [initialShowtime] = await createShowtimes(fix, [
                {
                    endTime: instant('2013-01-31T11:00Z'),
                    startTime: instant('2013-01-31T09:00Z'),
                    theaterId: theater.id
                }
            ])

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
