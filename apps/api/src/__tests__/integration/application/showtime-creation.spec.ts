import type { MovieDto, ShowtimesService, TheaterDto, TicketsService } from 'core'
import { DateUtil } from '@mannercode/common'
import { nullObjectId, type Response } from '@mannercode/testing'
import { createMovie, createShowtimes, createTheater, type AppTestContext } from '../helpers'
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
        fix = await createAppTestContext()
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
            // 새 16:00-16:30과 기존 16:30-18:00, 새 20:00-20:30과 기존
            // 18:30-20:00은 한 상영이 끝나는 시각에 다른 상영이 시작한다. 끝
            // 시각을 포함하지 않는 정책이라 충돌로 보지 않는다.
            const conflictingShowtimes = [initialShowtimes[0]]

            await expect(completionPromise).resolves.toEqual({
                conflictingShowtimes,
                sagaId: expect.any(String),
                status: 'failed'
            })
        })

        it('한 기존 상영 시간이 여러 새 시작 시각과 겹쳐도 결과에는 한 번만 들어간다', async () => {
            // 기존 12:00-13:30(90분) 하나가 새 12:00, 12:30, 13:00 세 시작
            // 시각 모두의 첫 슬롯에 걸린다. 중복 제거가 빠지면 같은 상영이
            // 세 번 결과에 들어간다.
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
            // 기존 10:00-12:00과 새 10:05-11:05는 55분이 겹친다. 슬롯 격자로
            // 비교하면 시작 분이 다를 때 키 교집합이 비어 충돌을 놓친다.
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
            // 시작 시각만 보면 새 범위 바깥이지만, 끝 시각이 새 범위와
            // 겹치므로 충돌로 봐야 한다.
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
