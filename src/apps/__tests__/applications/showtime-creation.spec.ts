import { Seatmap, ShowtimeDto } from 'apps/cores'
import { expectEqualUnsorted, nullDate, nullObjectId } from 'testlib'
import { createShowtimes } from '../common.fixture'
import { createShowtimeDtos, Fixture, monitorEvents } from './showtime-creation.fixture'

describe('ShowtimeCreationService', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./showtime-creation.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('GET /showtime-creation/movies', () => {
        // 기대 결과: 페이지네이션된 영화 목록을 반환한다.
        it('returns a paginated list of movies', async () => {
            const { body } = await fix.httpClient
                .get('/showtime-creation/movies')
                .query({ skip: 0 })
                .ok()
            const { items, ...paginated } = body

            expect(paginated).toEqual({ skip: 0, take: expect.any(Number), total: 1 })
            expect(items).toEqual([fix.movie])
        })
    })

    describe('GET /showtime-creation/theaters', () => {
        // 기대 결과: 페이지네이션된 극장 목록을 반환한다.
        it('returns a paginated list of theaters', async () => {
            const { body } = await fix.httpClient
                .get('/showtime-creation/theaters')
                .query({ skip: 0 })
                .ok()
            const { items, ...paginated } = body

            expect(paginated).toEqual({ skip: 0, take: expect.any(Number), total: 1 })
            expect(items).toEqual([fix.theater])
        })
    })

    describe('POST /showtime-creation/showtimes/search', () => {
        let showtimes: ShowtimeDto[]

        beforeEach(async () => {
            const createDtos = createShowtimeDtos({
                startTimes: [
                    new Date('2100-01-01T09:00'),
                    new Date('2100-01-01T11:00'),
                    new Date('2100-01-01T13:00')
                ],
                theaterId: fix.theater.id,
                durationInMinutes: 1
            })
            showtimes = await createShowtimes(fix, createDtos)
        })

        // 기대 결과: 예정된 상영시간 목록을 반환한다.
        it('returns a list of scheduled showtimes', async () => {
            const { body } = await fix.httpClient
                .post('/showtime-creation/showtimes/search')
                .body({ theaterIds: [fix.theater.id] })
                .ok()

            expectEqualUnsorted(body, showtimes)
        })
    })

    describe('POST /showtime-creation/showtimes', () => {
        const requestShowtimeCreation = async (
            movieId: string,
            theaterIds: string[],
            startTimes: Date[]
        ) => {
            const { body } = await fix.httpClient
                .post('/showtime-creation/showtimes')
                .body({ movieId, theaterIds, startTimes, durationInMinutes: 1 })
                .accepted()
            return body
        }

        // 상황: 유효한 데이터로 생성 요청 시
        describe('when the creation request is valid', () => {
            // 기대 결과: 상영시간과 티켓을 성공적으로 생성한다.
            it('successfully creates the showtimes and tickets', async () => {
                const monitorPromise = monitorEvents(fix.httpClient, ['succeeded'])
                const theaterIds = [fix.theater.id]
                const startTimes = [new Date('2100-01-01T09:00'), new Date('2100-01-01T11:00')]

                const { transactionId } = await requestShowtimeCreation(
                    fix.movie.id,
                    theaterIds,
                    startTimes
                )
                expect(transactionId).toBeDefined()

                const seatCount = Seatmap.getSeatCount(fix.theater.seatmap)
                const createdShowtimeCount = theaterIds.length * startTimes.length
                const createdTicketCount = createdShowtimeCount * seatCount

                await expect(monitorPromise).resolves.toEqual({
                    transactionId,
                    status: 'succeeded',
                    createdShowtimeCount,
                    createdTicketCount
                })
            })
        })

        // 상황: 유효하지 않은 데이터로 생성 요청 시
        describe('when the creation request contains invalid data', () => {
            // 기대 결과: 영화가 존재하지 않으면 에러를 보고한다.
            it('reports an error if the specified movie does not exist', async () => {
                const monitorPromise = monitorEvents(fix.httpClient, ['error'])
                const { transactionId } = await requestShowtimeCreation(
                    nullObjectId,
                    [fix.theater.id],
                    [nullDate]
                )

                expect(transactionId).toBeDefined()

                await expect(monitorPromise).resolves.toEqual({
                    transactionId,
                    status: 'error',
                    message: 'The requested movie could not be found.'
                })
            })

            // 기대 결과: 극장이 존재하지 않으면 에러를 보고한다.
            it('reports an error if any specified theater does not exist', async () => {
                const monitorPromise = monitorEvents(fix.httpClient, ['error'])
                const { transactionId } = await requestShowtimeCreation(
                    fix.movie.id,
                    [nullObjectId],
                    [nullDate]
                )

                expect(transactionId).toBeDefined()

                await expect(monitorPromise).resolves.toEqual({
                    transactionId,
                    status: 'error',
                    message: 'One or more requested theaters could not be found.'
                })
            })
        })

        // 상황: 상영시간이 충돌할 때
        describe('when there are scheduling conflicts', () => {
            let existingShowtimes: ShowtimeDto[]

            beforeEach(async () => {
                const createDtos = createShowtimeDtos({
                    startTimes: [
                        new Date('2013-01-31T12:00'),
                        new Date('2013-01-31T14:00'),
                        new Date('2013-01-31T16:30'),
                        new Date('2013-01-31T18:30')
                    ],
                    theaterId: fix.theater.id,
                    durationInMinutes: 90
                })
                existingShowtimes = await createShowtimes(fix, createDtos)
            })

            // 기대 결과: 실패 상태와 함께 충돌하는 상영시간 정보를 반환한다.
            it('returns a "failed" status with conflicting showtime details', async () => {
                const monitorPromise = monitorEvents(fix.httpClient, ['failed'])
                const { body } = await fix.httpClient
                    .post('/showtime-creation/showtimes')
                    .body({
                        movieId: fix.movie.id,
                        theaterIds: [fix.theater.id],
                        startTimes: [
                            new Date('2013-01-31T12:00'),
                            new Date('2013-01-31T16:00'),
                            new Date('2013-01-31T20:00')
                        ],
                        durationInMinutes: 30
                    })
                    .accepted()

                const { transactionId } = body
                expect(transactionId).toBeDefined()

                const expectedConflicts = existingShowtimes.filter((showtime) =>
                    [
                        new Date('2013-01-31T12:00').getTime(),
                        new Date('2013-01-31T16:30').getTime(),
                        new Date('2013-01-31T18:30').getTime()
                    ].includes(showtime.startTime.getTime())
                )

                const { conflictingShowtimes, ...result } = (await monitorPromise) as any
                expect(result).toEqual({ transactionId, status: 'failed' })
                expectEqualUnsorted(conflictingShowtimes, expectedConflicts)
            })
        })
    })
})
