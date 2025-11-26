import { ShowtimeDto } from 'apps/cores'
import { DateUtil, pickIds } from 'common'
import { nullObjectId, oid } from 'testlib'
import { buildCreateShowtimeDto, createShowtimes } from '../__helpers__'
import type { Fixture } from './showtimes.fixture'

describe('ShowtimesService', () => {
    let fixture: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./showtimes.fixture')
        fixture = await createFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('createMany', () => {
        // payload가 유효한 경우
        describe('when the payload is valid', () => {
            // 상영시간을 생성하고 결과를 반환한다
            it('creates showtimes and returns the result', async () => {
                const createDtos = [buildCreateShowtimeDto({ transactionId: oid(0x1) })]

                const { success } = await fixture.showtimesService.createMany(createDtos)

                expect(success).toBe(true)
            })
        })
    })

    describe('getMany', () => {
        // 상영시간이 존재하는 경우
        describe('when the showtimes exist', () => {
            let showtimes: ShowtimeDto[]

            beforeEach(async () => {
                const createDtos = [
                    { startTime: new Date('2000-01-01T12:00') },
                    { startTime: new Date('2000-01-01T14:00') }
                ]

                showtimes = await createShowtimes(fixture, createDtos)
            })

            // 상영시간들을 반환한다
            it('returns the showtimes', async () => {
                const showtimeIds = pickIds(showtimes)

                const gotShowtimes = await fixture.showtimesService.getMany(showtimeIds)

                expect(gotShowtimes).toEqual(expect.arrayContaining(showtimes))
            })
        })

        // 상영시간이 존재하지 않는 경우
        describe('when the showtimes do not exist', () => {
            // 404 status를 던진다
            it('throws 404 status', async () => {
                const promise = fixture.showtimesService.getMany([nullObjectId])

                await expect(promise).rejects.toMatchObject({
                    status: 404,
                    message: 'One or more documents not found'
                })
            })
        })
    })

    describe('search', () => {
        const transactionId = oid(0x1)
        const movieId = oid(0x2)
        const theaterId = oid(0x3)
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

            createdShowtimes = await createShowtimes(fixture, createDtos)
        })

        // `transactionIds`가 제공된 경우
        describe('when the `transactionIds` are provided', () => {
            // 지정한 transactionIds와 일치하는 상영시간 목록을 반환한다.
            it('returns showtimes for the transactionIds', async () => {
                const showtimes = await fixture.showtimesService.search({
                    transactionIds: [transactionId]
                })

                expect(showtimes).toEqual([createdShowtimes[0]])
            })
        })

        // `movieIds`가 제공된 경우
        describe('when the `movieIds` are provided', () => {
            // 지정한 movieIds와 일치하는 상영시간 목록을 반환한다.
            it('returns showtimes for the movieIds', async () => {
                const showtimes = await fixture.showtimesService.search({ movieIds: [movieId] })

                expect(showtimes).toEqual([createdShowtimes[1]])
            })
        })

        // `theaterIds`가 제공된 경우
        describe('when the `theaterIds` are provided', () => {
            // 지정한 theaterIds와 일치하는 상영시간 목록을 반환한다.
            it('returns showtimes for the theaterIds', async () => {
                const showtimes = await fixture.showtimesService.search({ theaterIds: [theaterId] })

                expect(showtimes).toEqual([createdShowtimes[2]])
            })
        })

        // `startTimeRange`가 제공된 경우
        describe('when the `startTimeRange` is provided', () => {
            // startTimeRange에 포함되는 상영시간 목록을 반환한다.
            it('returns showtimes in the startTimeRange', async () => {
                const startTimeRange = {
                    start: new Date('2020-01-01T00:00'),
                    end: new Date('2020-01-02T12:00')
                }

                const showtimes = await fixture.showtimesService.search({ startTimeRange })

                expect(showtimes).toEqual(
                    expect.arrayContaining([createdShowtimes[3], createdShowtimes[4]])
                )
            })
        })

        // 필터가 비어있는 경우
        describe('when the filter is empty', () => {
            // 400 status를 던진다
            it('throws 400 status', async () => {
                const promise = fixture.showtimesService.search({})

                await expect(promise).rejects.toMatchObject({
                    status: 400,
                    message: 'At least one filter condition must be provided'
                })
            })
        })
    })

    describe('searchMovieIds', () => {
        // `startTimeRange`가 제공된 경우
        describe('when the `startTimeRange` is provided', () => {
            beforeEach(async () => {
                const now = (minutes: number) => DateUtil.add({ minutes })

                const createDtos = [
                    { movieId: oid(0x1), startTime: now(-90) },
                    { movieId: oid(0x2), startTime: now(0) },
                    { movieId: oid(0x3), startTime: now(1) },
                    { movieId: oid(0x4), startTime: now(120) }
                ]

                await createShowtimes(fixture, createDtos)
            })

            // startTimeRange에 포함되는 영화 ID 목록을 반환한다
            it('returns movie IDs in the startTimeRange', async () => {
                const movieIds = await fixture.showtimesService.searchMovieIds({
                    startTimeRange: { start: new Date() }
                })

                expect(movieIds).toEqual([oid(0x3), oid(0x4)])
            })
        })
    })

    describe('searchTheaterIds', () => {
        const movieId = oid(0x10)

        // `movieIds`가 제공된 경우
        describe('when the `movieIds` are provided', () => {
            beforeEach(async () => {
                const createDtos = [
                    { movieId, theaterId: oid(0x1) },
                    { movieId, theaterId: oid(0x2) },
                    { movieId: oid(0x0), theaterId: oid(0x3) }
                ]

                await createShowtimes(fixture, createDtos)
            })

            // movieIds를 상영하는 극장의 ID 목록을 반환한다
            it('returns theater IDs for the movieIds', async () => {
                const theaterIds = await fixture.showtimesService.searchTheaterIds({
                    movieIds: [movieId]
                })

                expect(theaterIds).toEqual([oid(0x1), oid(0x2)])
            })
        })
    })

    describe('searchShowdates', () => {
        const movieId = oid(0x1)
        const theaterId = oid(0x2)

        // `movieIds`와 `theaterIds`가 제공된 경우
        describe('when the `movieIds` and `theaterIds` are provided', () => {
            beforeEach(async () => {
                const createDtos = [
                    { movieId, theaterId, startTime: new Date('2000-01-01') },
                    { movieId, theaterId, startTime: new Date('2000-01-02') },
                    { movieId, theaterId: oid(0x0), startTime: new Date('2000-01-03') }
                ]

                await createShowtimes(fixture, createDtos)
            })

            // theaterIds에서 상영하는 movieIds의 상영일 목록을 반환한다.
            it('returns showdates for the movieIds and theaterIds', async () => {
                const showdates = await fixture.showtimesService.searchShowdates({
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
