import type { MovieDto, ShowtimesService, TheaterDto, TicketsService } from 'core'
import { DateUtil, JsonUtil, sleep } from '@mannercode/common'
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
    let showtimesService: ShowtimesService
    let ticketsService: TicketsService
    let movie: MovieDto
    let theater: TheaterDto

    beforeEach(async () => {
        const { createAppTestContext } = await import('../helpers')
        const { ShowtimesService, TicketsService } = await import('core')
        const { AdminAuthGuard } = await import('gateway')
        fix = await createAppTestContext({ ignoreGuards: [AdminAuthGuard] })
        showtimesService = fix.module.get(ShowtimesService)
        ticketsService = fix.module.get(TicketsService)

        movie = await createMovie(fix)
        theater = await createTheater(fix)
    })
    afterEach(() => fix.teardown())

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

        describe('생성 도중 티켓 생성이 실패하면', () => {
            // 상영 시간은 모두 저장되고, 티켓은 일부 묶음까지 저장된 뒤 다음 묶음에서 던진다.
            // 검증에서 멈추는 위의 오류 케이스와 달리 상영 시간·티켓 행이 실제로 남은 뒤 실패하므로,
            // 보상이 상영 시간과 티켓을 모두 되돌리는 경로를 검증한다.
            let sagaId: string
            let createShowtimesSpy: jest.SpyInstance
            let persistedTicketCount: number

            beforeEach(async () => {
                persistedTicketCount = 0
                // 상영 시간 생성은 통과시키되 호출을 관찰한다.
                createShowtimesSpy = jest.spyOn(showtimesService, 'createMany')

                // 첫 티켓 묶음은 실제로 적재하고, 그 적재가 끝난 뒤 다음 묶음에서 실패시킨다.
                // 일부 티켓이 DB에 남은 상태로 보상이 돌게 해야 '티켓 삭제' 단언이 헛돌지 않는다.
                const realCreateMany = ticketsService.createMany.bind(ticketsService)
                let firstBatch: ReturnType<typeof realCreateMany> | undefined
                jest.spyOn(ticketsService, 'createMany').mockImplementation(async (createDtos) => {
                    if (!firstBatch) {
                        firstBatch = realCreateMany(createDtos)
                        const result = await firstBatch
                        persistedTicketCount = result.count
                        return result
                    }
                    // 첫 묶음이 커밋된 뒤에 던져, 보상 시점에 지울 티켓이 반드시 존재하게 한다.
                    await firstBatch
                    throw new Error('ticket creation failed')
                })

                const completionPromise = waitForCompletion(fix, 'error')
                const { body } = await fix.httpClient
                    .post('/showtime-creation/showtimes')
                    .body({
                        durationInMinutes: 1,
                        movieId: movie.id,
                        startTimes: [new Date('2100-01-01T09:00'), new Date('2100-01-01T11:00')],
                        theaterIds: [theater.id]
                    })
                    .accepted()
                sagaId = body.sagaId
                await completionPromise
            })

            it('롤백 대상이 되도록 상영 시간과 티켓을 실제로 먼저 생성한다', () => {
                // 보상 검증이 빈 상태를 빈 상태로 비교하는 헛돌이가 되지 않도록, 되돌릴 대상이 만들어졌는지 먼저 확인한다.
                expect(createShowtimesSpy.mock.calls[0][0]).not.toHaveLength(0)
                expect(persistedTicketCount).toBeGreaterThan(0)
            })

            it('보상으로 생성된 상영 시간을 모두 삭제한다', async () => {
                const showtimes = await showtimesService.search({ sagaIds: [sagaId] })
                expect(showtimes).toEqual([])
            })

            it('보상으로 생성된 티켓을 모두 삭제한다', async () => {
                const tickets = await ticketsService.search({ sagaIds: [sagaId] })
                expect(tickets).toEqual([])
            })
        })

        describe('보상 중 삭제가 한 번 실패하면', () => {
            // compensate는 실패를 던져 Temporal 재시도 정책에 맡긴다. 삭제는 멱등이라 재실행이 안전하다.
            beforeEach(() => {
                jest.spyOn(ticketsService, 'createMany').mockRejectedValueOnce(
                    new Error('ticket creation failed')
                )
                jest.spyOn(ticketsService, 'deleteBySagaIds').mockRejectedValueOnce(
                    new Error('delete failed')
                )
            })

            it('재시도로 정리를 끝낸 뒤 오류 상태를 전송한다', async () => {
                const completionPromise = waitForCompletion(fix, 'error')

                const { body } = await fix.httpClient
                    .post('/showtime-creation/showtimes')
                    .body({
                        durationInMinutes: 1,
                        movieId: movie.id,
                        startTimes: [new Date('2100-01-01T09:00')],
                        theaterIds: [theater.id]
                    })
                    .accepted()

                await completionPromise

                const showtimes = await showtimesService.search({ sagaIds: [body.sagaId] })
                expect(showtimes).toEqual([])
            })
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
