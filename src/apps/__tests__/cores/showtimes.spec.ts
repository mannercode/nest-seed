import { ShowtimeDto } from 'apps/cores'
import { DateUtil, pickIds } from 'common'
import { expectEqualUnsorted, nullObjectId, testObjectId } from 'testlib'
import { buildCreateShowtimeDto, createShowtimes } from '../__helpers__'
import { Fixture } from './showtimes.fixture'

describe('ShowtimesService', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./showtimes.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('createShowtimes', () => {
        // payload가 유효한 경우
        describe('when the payload is valid', () => {
            // 상영시간을 생성하고 결과를 반환한다
            it('creates showtimes and returns the result', async () => {
                const createDtos = [buildCreateShowtimeDto({ transactionId: testObjectId(0x1) })]

                const { success } = await fix.showtimesClient.createShowtimes(createDtos)

                expect(success).toBeTruthy()
            })
        })
    })

    describe('searchShowtimes', () => {
        const transactionId = testObjectId(0x1)
        const movieId = testObjectId(0x2)
        const theaterId = testObjectId(0x3)
        let createdShowtimes: ShowtimeDto[]

        beforeEach(async () => {
            const createDtos = [
                { transactionId },
                { movieId },
                { theaterId },
                { startTime: new Date('2020-01-01T12:00') },
                { startTime: new Date('2020-01-01T14:00') },
                { startTime: new Date('2020-01-02T14:00') },
                { startTime: new Date('2020-01-03T12:00') }
            ]

            createdShowtimes = await createShowtimes(fix, createDtos)
        })

        // `transactionIds`가 제공된 경우
        describe('when `transactionIds` are provided', () => {
            // 지정한 transactionIds와 일치하는 상영시간 목록을 반환한다.
            it('returns the showtimes matching the given transactionIds', async () => {
                const showtimes = await fix.showtimesClient.searchShowtimes({
                    transactionIds: [transactionId]
                })

                expectEqualUnsorted(showtimes, [createdShowtimes[0]])
            })
        })

        // `movieIds`가 제공된 경우
        describe('when `movieIds` are provided', () => {
            // 지정한 movieIds와 일치하는 상영시간 목록을 반환한다.
            it('returns the showtimes matching the given movieIds', async () => {
                const showtimes = await fix.showtimesClient.searchShowtimes({ movieIds: [movieId] })

                expectEqualUnsorted(showtimes, [createdShowtimes[1]])
            })
        })

        // `theaterIds`가 제공된 경우
        describe('when `theaterIds` are provided', () => {
            // 지정한 theaterIds와 일치하는 상영시간 목록을 반환한다.
            it('returns the showtimes matching the given theaterIds', async () => {
                const showtimes = await fix.showtimesClient.searchShowtimes({
                    theaterIds: [theaterId]
                })

                expectEqualUnsorted(showtimes, [createdShowtimes[2]])
            })
        })

        // `startTimeRange`가 제공된 경우
        describe('when `startTimeRange` is provided', () => {
            // startTimeRange에 포함되는 상영시간 목록을 반환한다.
            it('returns the showtimes within the given startTimeRange', async () => {
                const startTimeRange = {
                    start: new Date('2020-01-01T00:00'),
                    end: new Date('2020-01-02T12:00')
                }

                const showtimes = await fix.showtimesClient.searchShowtimes({ startTimeRange })

                expectEqualUnsorted(showtimes, [createdShowtimes[3], createdShowtimes[4]])
            })
        })

        // 필터가 비어있는 경우
        describe('when the filter is empty', () => {
            // 에러를 던진다.
            it('throws an error', async () => {
                const promise = fix.showtimesClient.searchShowtimes({})

                await expect(promise).rejects.toThrow(
                    'At least one filter condition must be provided'
                )
            })
        })
    })

    describe('getShowtimes', () => {
        let showtimes: ShowtimeDto[]

        beforeEach(async () => {
            const createDtos = [
                { startTime: new Date('2000-01-01T12:00') },
                { startTime: new Date('2000-01-01T14:00') }
            ]

            showtimes = await createShowtimes(fix, createDtos)
        })

        // 상영시간이 존재하는 경우
        describe('when the showtimes exist', () => {
            // 상영시간들을 반환한다
            it('returns the showtimes', async () => {
                const showtimeIds = pickIds(showtimes)

                const gotShowtimes = await fix.showtimesClient.getShowtimes(showtimeIds)

                expectEqualUnsorted(gotShowtimes, showtimes)
            })
        })

        // 상영시간이 존재하지 않는 경우
        describe('when the showtimes do not exist', () => {
            // NotFoundException을 던진다
            it('throws NotFoundException', async () => {
                const promise = fix.showtimesClient.getShowtimes([nullObjectId])

                await expect(promise).rejects.toThrow('One or more documents not found')
            })
        })
    })

    describe('searchMovieIds', () => {
        // `startTimeRange`가 제공된 경우
        describe('when `startTimeRange` is provided', () => {
            beforeEach(async () => {
                const now = (minutes: number) => DateUtil.addMinutes(new Date(), minutes)

                const createDtos = [
                    { movieId: testObjectId(0x1), startTime: now(-90) },
                    { movieId: testObjectId(0x2), startTime: now(0) },
                    { movieId: testObjectId(0x3), startTime: now(1) },
                    { movieId: testObjectId(0x4), startTime: now(120) }
                ]

                await createShowtimes(fix, createDtos)
            })

            // startTimeRange에 포함되는 영화 ID 목록을 반환한다
            it('returns the movie IDs within the given startTimeRange', async () => {
                const movieIds = await fix.showtimesClient.searchMovieIds({
                    startTimeRange: { start: new Date() }
                })

                expect(movieIds).toEqual([testObjectId(0x3), testObjectId(0x4)])
            })
        })
    })

    describe('searchTheaterIds', () => {
        const movieId = testObjectId(0x10)

        // `movieIds`가 제공된 경우
        describe('when `movieIds` are provided', () => {
            beforeEach(async () => {
                const createDtos = [
                    { movieId, theaterId: testObjectId(0x1) },
                    { movieId, theaterId: testObjectId(0x2) },
                    { movieId: nullObjectId, theaterId: testObjectId(0x3) }
                ]

                await createShowtimes(fix, createDtos)
            })

            // movieIds를 상영하는 극장의 ID 목록을 반환한다
            it('returns the theater IDs for the given movieIds', async () => {
                const theaterIds = await fix.showtimesClient.searchTheaterIds({
                    movieIds: [movieId]
                })

                expect(theaterIds).toEqual([testObjectId(0x1), testObjectId(0x2)])
            })
        })
    })

    describe('searchShowdates', () => {
        const movieId = testObjectId(0x1)
        const theaterId = testObjectId(0x2)

        // `movieIds`와 `theaterIds`가 제공된 경우
        describe('when `movieIds` and `theaterIds` are provided', () => {
            beforeEach(async () => {
                const createDtos = [
                    { movieId, theaterId, startTime: new Date('2000-01-01') },
                    { movieId, theaterId, startTime: new Date('2000-01-02') },
                    { movieId, theaterId: nullObjectId, startTime: new Date('2000-01-03') }
                ]

                await createShowtimes(fix, createDtos)
            })

            // theaterIds에서 상영하는 movieIds의 상영일 목록을 반환한다.
            it('returns the showdates for the given movieIds and theaterIds', async () => {
                const showdates = await fix.showtimesClient.searchShowdates({
                    movieIds: [movieId],
                    theaterIds: [theaterId]
                })

                expect(showdates.map((d) => d.getTime())).toEqual([
                    new Date('2000-01-01').getTime(),
                    new Date('2000-01-02').getTime()
                ])
            })
        })
    })
})
