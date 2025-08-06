import { Seatmap, ShowtimeDto } from 'apps/cores'
import { DateUtil } from 'common'
import { nullDate, nullObjectId } from 'testlib'
import { createShowtimes } from '../__helpers__'
import { Fixture, monitorEvents } from './showtime-creation.fixture'

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
        // 페이지네이션된 영화 목록을 반환한다
        it('returns movies with pagination', async () => {
            const { body } = await fix.httpClient.get('/showtime-creation/movies').ok()

            const { items, ...pagination } = body
            expect(pagination).toEqual({ skip: 0, take: expect.any(Number), total: 1 })
            expect(items).toEqual([fix.movie])
        })
    })

    // 극장 목록을 조회한다
    describe('GET /showtime-creation/theaters', () => {
        it('returns theaters with pagination', async () => {
            await fix.httpClient
                .get('/showtime-creation/theaters')
                .ok({ skip: 0, take: expect.any(Number), total: 1, items: [fix.theater] })
        })
    })

    describe('POST /showtime-creation/showtimes/search', () => {
        let showtimes: ShowtimeDto[]

        beforeEach(async () => {
            const createDtos = [
                new Date('2100-01-01T09:00'),
                new Date('2100-01-01T11:00'),
                new Date('2100-01-01T13:00')
            ].map((startTime) => ({ theaterId: fix.theater.id, startTime }))

            showtimes = await createShowtimes(fix, createDtos)
        })

        // 해당 극장의 상영시간을 반환한다
        it('returns scheduled showtimes for the given theaters', async () => {
            await fix.httpClient
                .post('/showtime-creation/showtimes/search')
                .body({ theaterIds: [fix.theater.id] })
                .ok(expect.arrayContaining(showtimes))
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

        // 요청이 유효한 경우
        describe('when the request is valid', () => {
            // 상영시간과 티켓을 생성한다
            it('creates showtimes and tickets', async () => {
                // TODO waitEvents로 변경
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

        // 영화가 존재하지 않는 경우
        describe('when the movie does not exist', () => {
            // 존재하지 않는 영화에 대해 에러를 반환한다
            it('reports an error for the missing movie', async () => {
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
        })

        // 극장이 존재하지 않는 경우
        describe('when any theater does not exist', () => {
            // 존재하지 않는 극장에 대해 에러를 반환한다
            it('reports an error for the missing theater', async () => {
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

        // 상영시간이 충돌하는 경우
        describe('when showtimes conflict', () => {
            let existingShowtimes: ShowtimeDto[]

            beforeEach(async () => {
                const createDtos = [
                    new Date('2013-01-31T12:00'),
                    new Date('2013-01-31T14:00'),
                    new Date('2013-01-31T16:30'),
                    new Date('2013-01-31T18:30')
                ].map((startTime) => ({
                    theaterId: fix.theater.id,
                    startTime,
                    endTime: DateUtil.add({ minutes: 90, base: startTime })
                }))

                existingShowtimes = await createShowtimes(fix, createDtos)
            })

            // 충돌하는 상영시간을 반환한다
            it('returns the conflicting showtimes', async () => {
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

                // 위에 startTimes에서 가져와야지
                const expectedConflicts = existingShowtimes.filter((showtime) =>
                    [
                        new Date('2013-01-31T12:00').getTime(),
                        new Date('2013-01-31T16:30').getTime(),
                        new Date('2013-01-31T18:30').getTime()
                    ].includes(showtime.startTime.getTime())
                )

                const result = (await monitorPromise) as any

                expect(result).toEqual({
                    transactionId,
                    status: 'failed',
                    conflictingShowtimes: expect.arrayContaining(expectedConflicts)
                })
            })
        })
    })
})
