import type {
    LegacyShowtimeCreationActivities,
    ShowtimeBulkValidatorService,
    ShowtimeCreationPersistenceService
} from 'application'
import type { MovieDto, ShowtimesService, TheaterDto, TicketsService } from 'core'
import { DateUtil, JsonUtil, newObjectIdString, sleep } from '@mannercode/common'
import { HttpTestClient, nullObjectId, type Response } from '@mannercode/testing'
import {
    createMovie,
    createShowtimes,
    createTheater,
    Errors,
    type AppTestContext
} from '../helpers'
import { waitForCompletion } from './showtime-creation.utils'

describe('ShowtimeCreationService', () => {
    let fix: AppTestContext
    let teardown: AppTestContext['teardown'] | undefined
    let showtimesService: ShowtimesService
    let ticketsService: TicketsService
    let persistence: ShowtimeCreationPersistenceService
    let validatorService: ShowtimeBulkValidatorService
    let legacyActivities: LegacyShowtimeCreationActivities
    let movie: MovieDto
    let theater: TheaterDto

    beforeEach(async () => {
        teardown = undefined
        const { createAppTestContext } = await import('../helpers')
        const { ShowtimesService, TicketsService } = await import('core')
        const {
            LegacyShowtimeCreationActivities,
            ShowtimeBulkValidatorService,
            ShowtimeCreationPersistenceService
        } = await import('application')
        const { AdminAuthGuard } = await import('gateway')
        fix = await createAppTestContext({ ignoreGuards: [AdminAuthGuard] })
        teardown = fix.teardown
        showtimesService = fix.module.get(ShowtimesService)
        ticketsService = fix.module.get(TicketsService)
        persistence = fix.module.get(ShowtimeCreationPersistenceService)
        validatorService = fix.module.get(ShowtimeBulkValidatorService)
        legacyActivities = fix.module.get(LegacyShowtimeCreationActivities)

        movie = await createMovie(fix)
        theater = await createTheater(fix)
    })
    afterEach(() => teardown?.())

    const buildCreateDto = () => ({
        durationInMinutes: 1,
        movieId: movie.id,
        startTimes: [new Date('2100-01-01T09:00')],
        theaterIds: [theater.id]
    })

    describe('GET /showtime-creation/movies', () => {
        it('쿼리가 없으면 전체 영화 페이지를 반환한다', async () => {
            await fix.httpClient
                .get('/showtime-creation/movies')
                .ok({
                    items: [movie],
                    page: expect.any(Number),
                    size: expect.any(Number),
                    total: 1
                })
        })
    })

    describe('GET /showtime-creation/theaters', () => {
        it('쿼리가 없으면 전체 극장 페이지를 반환한다', async () => {
            await fix.httpClient
                .get('/showtime-creation/theaters')
                .ok({
                    items: [theater],
                    page: expect.any(Number),
                    size: expect.any(Number),
                    total: 1
                })
        })
    })

    describe('POST /showtime-creation/showtimes/search', () => {
        it('극장 ID 목록으로 상영 시간을 조회한다', async () => {
            const showtimes = await createShowtimes(
                fix,
                [
                    new Date('2100-01-01T09:00'),
                    new Date('2100-01-01T11:00'),
                    new Date('2100-01-01T13:00')
                ].map((startTime) => ({ startTime, theaterId: theater.id }))
            )

            await fix.httpClient
                .post('/showtime-creation/showtimes/search')
                .body({ theaterIds: [theater.id] })
                .ok(expect.arrayContaining(showtimes))
        })
    })

    describe('POST /showtime-creation/showtimes', () => {
        describe('정상 요청 흐름', () => {
            let createPromise: Promise<Response>

            beforeEach(async () => {
                createPromise = fix.httpClient
                    .post('/showtime-creation/showtimes')
                    .body({
                        durationInMinutes: 1,
                        movieId: movie.id,
                        startTimes: [new Date('2100-01-01T09:00')],
                        theaterIds: [theater.id]
                    })
                    .accepted()
            })

            it('사가 식별자를 반환한다', async () => {
                const { body } = await createPromise
                expect(body).toEqual(expect.objectContaining({ sagaId: expect.any(String) }))
            })

            it('SSE로 사가 상태 변화를 스트리밍한다', async () => {
                const eventPromise = new Promise((resolve, reject) => {
                    fix.httpClient.get('/showtime-creation/event-stream').sse((data) => {
                        const statusUpdate = JSON.parse(data)

                        if (['error', 'failed', 'succeeded'].includes(statusUpdate.status)) {
                            fix.httpClient.abort()

                            if ('succeeded' === statusUpdate.status) {
                                resolve(statusUpdate)
                            } else {
                                reject(
                                    new Error(`unexpected status: ${statusUpdate.status}`, {
                                        cause: statusUpdate
                                    })
                                )
                            }
                        }
                    }, reject)
                })

                const { body } = await createPromise

                await expect(eventPromise).resolves.toEqual(
                    expect.objectContaining({ sagaId: body.sagaId, status: 'succeeded' })
                )
            })

            it('상영 시간을 생성한다', async () => {
                const { body } = await createPromise
                const { createdShowtimeCount } = await waitForCompletion(fix, 'succeeded')

                const createdShowtimes = await showtimesService.search({ sagaIds: [body.sagaId] })
                expect(createdShowtimes).toHaveLength(createdShowtimeCount)
            })

            it('티켓을 생성한다', async () => {
                const { body } = await createPromise
                const { createdTicketCount } = await waitForCompletion(fix, 'succeeded')

                const createdTickets = await ticketsService.search({ sagaIds: [body.sagaId] })
                expect(createdTickets).toHaveLength(createdTicketCount)
            })
        })

        it('사가 상태를 waiting → processing → succeeded 순서로 발행한다', async () => {
            const { ShowtimeCreationEvents } = await import('application')
            const events = fix.module.get(ShowtimeCreationEvents)

            // 공유 httpClient는 뒤의 POST가 abort 대상을 바꾸므로 스트림 전용 클라이언트로 수신한다.
            const sseClient = new HttpTestClient(fix.httpClient.serverUrl)
            const received: { sagaId: string; status: string }[] = []
            let streamError: Error | undefined
            sseClient.get('/showtime-creation/event-stream').sse(
                (data) => received.push(JsonUtil.parse(data)),
                (reason) =>
                    (streamError = reason instanceof Error ? reason : new Error(String(reason)))
            )

            const waitUntil = async (
                predicate: () => boolean,
                beforeRetry?: () => Promise<void>
            ) => {
                while (!predicate()) {
                    if (streamError) throw streamError
                    await beforeRetry?.()
                    await sleep(50)
                }
            }

            // 스트림은 지난 이벤트를 재전송하지 않아, 구독 성립 전에 발행된 waiting은 사라진다.
            // 프로브가 수신될 때까지 반복 발행해 구독 성립을 확정한 뒤에야 POST한다.
            await waitUntil(
                () => received.some((event) => event.sagaId === nullObjectId),
                () => events.emitStatusChanged({ sagaId: nullObjectId, status: 'waiting' })
            )

            const { body } = await fix.httpClient
                .post('/showtime-creation/showtimes')
                .body({
                    durationInMinutes: 1,
                    movieId: movie.id,
                    startTimes: [new Date('2100-01-01T09:00')],
                    theaterIds: [theater.id]
                })
                .accepted()

            await waitUntil(() =>
                received.some(
                    (event) =>
                        event.sagaId === body.sagaId &&
                        ['error', 'failed', 'succeeded'].includes(event.status)
                )
            )
            sseClient.abort()

            const statuses = received
                .filter((event) => event.sagaId === body.sagaId)
                .map((event) => event.status)
            expect(statuses).toEqual(['waiting', 'processing', 'succeeded'])
        })

        it('영화가 없으면 오류 상태를 전송한다', async () => {
            const completionPromise = waitForCompletion(fix, 'error')

            const { body } = await fix.httpClient
                .post('/showtime-creation/showtimes')
                .body({
                    durationInMinutes: 1,
                    movieId: nullObjectId,
                    startTimes: [new Date(0)],
                    theaterIds: [theater.id]
                })
                .accepted()

            await expect(completionPromise).resolves.toEqual({
                message: 'The requested movie could not be found.',
                sagaId: body.sagaId,
                status: 'error'
            })
        })

        it('극장이 없으면 오류 상태를 전송한다', async () => {
            const completionPromise = waitForCompletion(fix, 'error')

            const { body } = await fix.httpClient
                .post('/showtime-creation/showtimes')
                .body({
                    durationInMinutes: 1,
                    movieId: movie.id,
                    startTimes: [new Date(0)],
                    theaterIds: [nullObjectId]
                })
                .accepted()

            await expect(completionPromise).resolves.toEqual({
                message: 'One or more requested theaters could not be found.',
                sagaId: body.sagaId,
                status: 'error'
            })
        })

        it('요청 안의 시작 시각이 서로 겹치면 사가를 시작하지 않고 400을 반환한다', async () => {
            await fix.httpClient
                .post('/showtime-creation/showtimes')
                .body({
                    durationInMinutes: 90,
                    movieId: movie.id,
                    startTimes: [new Date('2100-01-01T09:00'), new Date('2100-01-01T10:00')],
                    theaterIds: [theater.id]
                })
                .badRequest(Errors.ShowtimeCreation.OverlappingStartTimes(expect.any(Array)))
        })

        it('같은 시작 시각이 중복되어도 400을 반환한다', async () => {
            const start = new Date('2100-01-01T09:00')

            await fix.httpClient
                .post('/showtime-creation/showtimes')
                .body({
                    durationInMinutes: 1,
                    movieId: movie.id,
                    startTimes: [start, start],
                    theaterIds: [theater.id]
                })
                .badRequest(Errors.ShowtimeCreation.OverlappingStartTimes(expect.any(Array)))
        })

        describe('트랜잭션 안에서 티켓을 저장한 뒤 실패하면', () => {
            let sagaId: string
            let createShowtimesSpy: jest.SpyInstance
            let attemptedTicketCount: number

            beforeEach(async () => {
                attemptedTicketCount = 0
                createShowtimesSpy = jest.spyOn(showtimesService, 'createMany')

                // 실제 insert까지 실행한 다음 throw한다. transaction이 없으면 showtimes와 tickets가 남는다.
                const realCreateMany = ticketsService.createMany.bind(ticketsService)
                jest.spyOn(ticketsService, 'createMany').mockImplementation(
                    async (createDtos, session, signal) => {
                        await realCreateMany(createDtos, session, signal)
                        attemptedTicketCount += createDtos.length
                        throw new Error('ticket creation failed after insert')
                    }
                )

                const completionPromise = waitForCompletion(fix, 'error')
                const { body } = await fix.httpClient
                    .post('/showtime-creation/showtimes')
                    .body({
                        ...buildCreateDto(),
                        startTimes: [new Date('2100-01-01T09:00'), new Date('2100-01-01T11:00')]
                    })
                    .accepted()
                sagaId = body.sagaId
                await completionPromise
            })

            it('Temporal 재시도마다 생성 쓰기까지 실제로 실행한다', () => {
                expect(createShowtimesSpy).toHaveBeenCalledTimes(4)
                expect(attemptedTicketCount).toBeGreaterThan(0)
            })

            it('실패한 transaction의 상영 시간과 티켓을 모두 롤백한다', async () => {
                const showtimes = await showtimesService.search({ sagaIds: [sagaId] })
                const tickets = await ticketsService.search({ sagaIds: [sagaId] })
                expect(showtimes).toEqual([])
                expect(tickets).toEqual([])
            })
        })

        it('티켓 저장이 한 번 실패해도 Activity 재시도로 한 세트만 생성한다', async () => {
            jest.spyOn(ticketsService, 'createMany').mockRejectedValueOnce(
                new Error('transient ticket write failure')
            )

            const completionPromise = waitForCompletion(fix, 'succeeded')
            const { body } = await fix.httpClient
                .post('/showtime-creation/showtimes')
                .body(buildCreateDto())
                .accepted()
            const completion = await completionPromise

            const showtimes = await showtimesService.search({ sagaIds: [body.sagaId] })
            const tickets = await ticketsService.search({ sagaIds: [body.sagaId] })
            expect(showtimes).toHaveLength(completion.createdShowtimeCount)
            expect(tickets).toHaveLength(completion.createdTicketCount)
        })

        it('커밋 뒤 첫 완료 보고를 잃어도 재시도가 저장 결과를 읽어 중복 없이 성공한다', async () => {
            const realValidateAndCreate = persistence.validateAndCreate.bind(persistence)
            const persistenceSpy = jest
                .spyOn(persistence, 'validateAndCreate')
                .mockImplementationOnce(async (...args) => {
                    // 실제 Activity heartbeat interval이 한 번 실행되는 장기 작업 경로도 함께 검증한다.
                    await sleep(5_100)
                    await realValidateAndCreate(...args)
                    throw new Error('activity completion response lost after commit')
                })
            const createShowtimesSpy = jest.spyOn(showtimesService, 'createMany')

            const completionPromise = waitForCompletion(fix, 'succeeded')
            const { body } = await fix.httpClient
                .post('/showtime-creation/showtimes')
                .body(buildCreateDto())
                .accepted()
            const completion = await completionPromise

            expect(persistenceSpy).toHaveBeenCalledTimes(2)
            expect(createShowtimesSpy).toHaveBeenCalledTimes(1)
            const showtimes = await showtimesService.search({ sagaIds: [body.sagaId] })
            const tickets = await ticketsService.search({ sagaIds: [body.sagaId] })
            expect(showtimes).toHaveLength(completion.createdShowtimeCount)
            expect(tickets).toHaveLength(completion.createdTicketCount)
        })

        it('같은 saga를 순차 재실행하면 저장된 결과를 반환하고 중복 생성하지 않는다', async () => {
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

        it('완료된 sagaId를 다른 입력으로 재사용하면 거부한다', async () => {
            const sagaId = newObjectIdString()
            const createDto = buildCreateDto()
            await persistence.validateAndCreate(createDto, sagaId)

            await expect(
                persistence.validateAndCreate(
                    { ...createDto, startTimes: [new Date('2100-01-01T11:00')] },
                    sagaId
                )
            ).rejects.toThrow(`Saga ID was reused with different input (sagaId=${sagaId})`)
        })

        it('한 operation의 상영 시간 수가 안전 상한을 넘으면 transaction 전에 거부한다', async () => {
            const createDto = {
                ...buildCreateDto(),
                startTimes: Array.from(
                    { length: 15 },
                    (_, index) => new Date(Date.UTC(2100, 0, 1, index))
                ),
                theaterIds: Array.from({ length: 15 }, () => newObjectIdString())
            }

            await expect(
                persistence.validateAndCreate(createDto, newObjectIdString())
            ).rejects.toMatchObject({
                response: { code: 'ERR_SHOWTIME_CREATION_TOO_MANY_SHOWTIMES', maximum: 200 }
            })
        })

        it('좌석 티켓 수가 안전 상한을 넘으면 showtime insert도 롤백한다', async () => {
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

        it('drain 중인 v1 Activity도 기존 비-transaction 호출 경로로 생성하고 보상한다', async () => {
            const sagaId = newObjectIdString()
            const result = await legacyActivities.validateAndCreate({
                createDto: buildCreateDto(),
                sagaId
            })

            expect(result.kind).toBe('succeeded')
            await legacyActivities.compensate(sagaId)
            await expect(showtimesService.search({ sagaIds: [sagaId] })).resolves.toEqual([])
            await expect(ticketsService.search({ sagaIds: [sagaId] })).resolves.toEqual([])
        })

        it('v1 validator도 존재하지 않는 극장을 거부한다', async () => {
            await expect(
                validatorService.validate({ ...buildCreateDto(), theaterIds: [nullObjectId] })
            ).rejects.toMatchObject({
                response: { code: 'ERR_SHOWTIME_CREATION_THEATERS_NOT_FOUND' }
            })
        })

        it('같은 saga를 동시에 재실행해도 두 호출이 같은 한 세트에 수렴한다', async () => {
            const sagaId = newObjectIdString()
            const createDto = buildCreateDto()

            const [first, second] = await Promise.all([
                persistence.validateAndCreate(createDto, sagaId),
                persistence.validateAndCreate(createDto, sagaId)
            ])

            expect(second).toEqual(first)
            const showtimes = await showtimesService.search({ sagaIds: [sagaId] })
            const tickets = await ticketsService.search({ sagaIds: [sagaId] })
            if (first.kind === 'succeeded') {
                expect(showtimes).toHaveLength(first.createdShowtimeCount)
                expect(tickets).toHaveLength(first.createdTicketCount)
            }
        })

        it('같은 극장의 겹치는 두 saga를 동시에 실행하면 정확히 하나만 생성한다', async () => {
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
                    new Date('2013-01-31T12:00'),
                    new Date('2013-01-31T14:00'),
                    new Date('2013-01-31T16:30'),
                    new Date('2013-01-31T18:30')
                ].map((startTime) => ({
                    endTime: DateUtil.add({ base: startTime, minutes: 90 }),
                    startTime,
                    theaterId: theater.id
                }))
            )

            const completionPromise = waitForCompletion(fix, 'failed')

            await fix.httpClient
                .post('/showtime-creation/showtimes')
                .body({
                    durationInMinutes: 30,
                    movieId: movie.id,
                    startTimes: [
                        new Date('2013-01-31T12:00'),
                        new Date('2013-01-31T16:00'),
                        new Date('2013-01-31T20:00')
                    ],
                    theaterIds: [theater.id]
                })
                .accepted()

            // 새 12:00-12:30은 기존 12:00-13:30과 시간이 겹치므로 충돌이다.
            // 새 16:00-16:30과 기존 16:30-18:00, 새 20:00-20:30과 기존 18:30-20:00은 한 상영이 끝나는 시각에 다른 상영이 시작한다.
            // 끝 시각을 포함하지 않는 정책이라 충돌로 보지 않는다.
            const conflictingShowtimes = [initialShowtimes[0]]

            await expect(completionPromise).resolves.toEqual({
                conflictingShowtimes,
                sagaId: expect.any(String),
                status: 'failed'
            })
        })

        it('한 극장만 충돌해도 전체가 실패하고 어느 극장에도 행을 남기지 않는다', async () => {
            // 첫 극장에만 겹치는 기존 상영을 두고, 충돌 없는 두 번째 극장을 같은 사가로 묶는다.
            const theaterB = await createTheater(fix)
            const [conflictingShowtime] = await createShowtimes(fix, [
                {
                    endTime: new Date('2013-01-31T13:30'),
                    startTime: new Date('2013-01-31T12:00'),
                    theaterId: theater.id
                }
            ])

            const completionPromise = waitForCompletion(fix, 'failed')

            const { body } = await fix.httpClient
                .post('/showtime-creation/showtimes')
                .body({
                    durationInMinutes: 90,
                    movieId: movie.id,
                    startTimes: [new Date('2013-01-31T12:00')],
                    theaterIds: [theater.id, theaterB.id]
                })
                .accepted()

            await expect(completionPromise).resolves.toEqual({
                conflictingShowtimes: [conflictingShowtime],
                sagaId: body.sagaId,
                status: 'failed'
            })

            // 검증 전체 통과 후에만 생성하므로, 충돌이 없던 두 번째 극장의 몫도 만들어지지 않아야 한다.
            const showtimes = await showtimesService.search({ sagaIds: [body.sagaId] })
            expect(showtimes).toEqual([])

            const tickets = await ticketsService.search({ sagaIds: [body.sagaId] })
            expect(tickets).toEqual([])
        })

        it('한 기존 상영 시간이 여러 새 시작 시각과 겹쳐도 결과에는 한 번만 들어간다', async () => {
            // 기존 12:00-13:30(90분) 하나가 새 12:00, 12:30, 13:00 세 시작 시각 모두의 첫 슬롯에 걸린다.
            // 중복 제거가 빠지면 같은 상영이 세 번 결과에 들어간다.
            const [initialShowtime] = await createShowtimes(fix, [
                {
                    endTime: new Date('2013-01-31T13:30'),
                    startTime: new Date('2013-01-31T12:00'),
                    theaterId: theater.id
                }
            ])

            const completionPromise = waitForCompletion(fix, 'failed')

            await fix.httpClient
                .post('/showtime-creation/showtimes')
                .body({
                    durationInMinutes: 10,
                    movieId: movie.id,
                    startTimes: [
                        new Date('2013-01-31T12:00'),
                        new Date('2013-01-31T12:30'),
                        new Date('2013-01-31T13:00')
                    ],
                    theaterIds: [theater.id]
                })
                .accepted()

            await expect(completionPromise).resolves.toEqual({
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
                    endTime: new Date('2013-01-31T12:00'),
                    startTime: new Date('2013-01-31T10:00'),
                    theaterId: theater.id
                }
            ])

            const completionPromise = waitForCompletion(fix, 'failed')

            await fix.httpClient
                .post('/showtime-creation/showtimes')
                .body({
                    durationInMinutes: 60,
                    movieId: movie.id,
                    startTimes: [new Date('2013-01-31T10:05')],
                    theaterIds: [theater.id]
                })
                .accepted()

            await expect(completionPromise).resolves.toEqual({
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
                    endTime: new Date('2013-01-31T11:00'),
                    startTime: new Date('2013-01-31T09:00'),
                    theaterId: theater.id
                }
            ])

            const completionPromise = waitForCompletion(fix, 'failed')

            await fix.httpClient
                .post('/showtime-creation/showtimes')
                .body({
                    durationInMinutes: 120,
                    movieId: movie.id,
                    startTimes: [new Date('2013-01-31T10:00')],
                    theaterIds: [theater.id]
                })
                .accepted()

            await expect(completionPromise).resolves.toEqual({
                conflictingShowtimes: [initialShowtime],
                sagaId: expect.any(String),
                status: 'failed'
            })
        })
    })
})
