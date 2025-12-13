import { ShowtimeDto } from 'apps/cores'
import { DateUtil, pickIds } from 'common'
import { nullObjectId, oid } from 'testlib'
import { buildCreateShowtimeDto, createShowtimes, Errors } from '../__helpers__'
import type { ShowtimesFixture } from './showtimes.fixture'

describe('ShowtimesService', () => {
    let fix: ShowtimesFixture

    beforeEach(async () => {
        const { createShowtimesFixture } = await import('./showtimes.fixture')
        fix = await createShowtimesFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('createMany', () => {
        describe('when the payload is valid', () => {
            it('creates showtimes and returns the result', async () => {
                const createDtos = [buildCreateShowtimeDto({ sagaId: oid(0x1) })]

                const { success } = await fix.showtimesService.createMany(createDtos)

                expect(success).toBe(true)
            })
        })
    })

    describe('getMany', () => {
        describe('when the showtimes exist', () => {
            let showtimes: ShowtimeDto[]

            beforeEach(async () => {
                const createDtos = [
                    { startTime: new Date('2000-01-01T12:00') },
                    { startTime: new Date('2000-01-01T14:00') }
                ]

                showtimes = await createShowtimes(fix, createDtos)
            })

            it('returns the showtimes', async () => {
                const showtimeIds = pickIds(showtimes)

                const gotShowtimes = await fix.showtimesService.getMany(showtimeIds)

                expect(gotShowtimes).toEqual(expect.arrayContaining(showtimes))
            })
        })

        describe('when the showtimes do not exist', () => {
            it('throws 404 status', async () => {
                const promise = fix.showtimesService.getMany([nullObjectId])

                await expect(promise).rejects.toMatchObject({
                    status: 404,
                    message: Errors.Mongoose.MultipleDocumentsNotFound.message
                })
            })
        })
    })

    describe('search', () => {
        const sagaId = oid(0x1)
        const movieId = oid(0x2)
        const theaterId = oid(0x3)
        let showtimeForSaga: ShowtimeDto
        let showtimeForMovie: ShowtimeDto
        let showtimeForTheater: ShowtimeDto
        let showtimeAtStartTime1: ShowtimeDto
        let showtimeAtStartTime2: ShowtimeDto

        beforeEach(async () => {
            ;[showtimeForSaga] = await createShowtimes(fix, [{ sagaId }])
            ;[showtimeForMovie] = await createShowtimes(fix, [{ movieId }])
            ;[showtimeForTheater] = await createShowtimes(fix, [{ theaterId }])
            ;[showtimeAtStartTime1, showtimeAtStartTime2] = await createShowtimes(fix, [
                { startTime: new Date('2020-01-01T12:00') },
                { startTime: new Date('2020-01-01T14:00') }
            ])

            await createShowtimes(fix, [
                { startTime: new Date('2020-01-02T14:00') },
                { startTime: new Date('2020-01-03T12:00') }
            ])
        })

        describe('when the `sagaIds` are provided', () => {
            it('returns showtimes for the sagaIds', async () => {
                const showtimes = await fix.showtimesService.search({ sagaIds: [sagaId] })

                expect(showtimes).toEqual([showtimeForSaga])
            })
        })

        describe('when the `movieIds` are provided', () => {
            it('returns showtimes for the movieIds', async () => {
                const showtimes = await fix.showtimesService.search({ movieIds: [movieId] })

                expect(showtimes).toEqual([showtimeForMovie])
            })
        })

        describe('when the `theaterIds` are provided', () => {
            it('returns showtimes for the theaterIds', async () => {
                const showtimes = await fix.showtimesService.search({ theaterIds: [theaterId] })

                expect(showtimes).toEqual([showtimeForTheater])
            })
        })

        describe('when the `startTimeRange` is provided', () => {
            it('returns showtimes in the startTimeRange', async () => {
                const startTimeRange = {
                    start: new Date('2020-01-01T00:00'),
                    end: new Date('2020-01-02T12:00')
                }

                const showtimes = await fix.showtimesService.search({ startTimeRange })

                expect(showtimes).toEqual(
                    expect.arrayContaining([showtimeAtStartTime1, showtimeAtStartTime2])
                )
            })
        })

        describe('when the filter is empty', () => {
            it('throws 400 status', async () => {
                const promise = fix.showtimesService.search({})

                await expect(promise).rejects.toMatchObject({
                    status: 400,
                    message: Errors.Mongoose.FiltersRequired.message
                })
            })
        })
    })

    describe('searchMovieIds', () => {
        describe('when the `startTimeRange` is provided', () => {
            beforeEach(async () => {
                const now = (minutes: number) => DateUtil.add({ minutes })

                const createDtos = [
                    { movieId: oid(0x1), startTime: now(-90) },
                    { movieId: oid(0x2), startTime: now(0) },
                    { movieId: oid(0x3), startTime: now(1) },
                    { movieId: oid(0x4), startTime: now(120) }
                ]

                await createShowtimes(fix, createDtos)
            })

            it('returns movie IDs in the startTimeRange', async () => {
                const movieIds = await fix.showtimesService.searchMovieIds({
                    startTimeRange: { start: new Date() }
                })

                expect(movieIds).toEqual([oid(0x3), oid(0x4)])
            })
        })
    })

    describe('searchTheaterIds', () => {
        const movieId = oid(0x10)

        describe('when the `movieIds` are provided', () => {
            beforeEach(async () => {
                const createDtos = [
                    { movieId, theaterId: oid(0x1) },
                    { movieId, theaterId: oid(0x2) },
                    { movieId: oid(0x0), theaterId: oid(0x3) }
                ]

                await createShowtimes(fix, createDtos)
            })

            it('returns theater IDs for the movieIds', async () => {
                const theaterIds = await fix.showtimesService.searchTheaterIds({
                    movieIds: [movieId]
                })

                expect(theaterIds).toEqual([oid(0x1), oid(0x2)])
            })
        })
    })

    describe('searchShowdates', () => {
        const movieId = oid(0x1)
        const theaterId = oid(0x2)

        describe('when the `movieIds` and `theaterIds` are provided', () => {
            beforeEach(async () => {
                const createDtos = [
                    { movieId, theaterId, startTime: new Date('2000-01-01') },
                    { movieId, theaterId, startTime: new Date('2000-01-02') },
                    { movieId, theaterId: oid(0x0), startTime: new Date('2000-01-03') }
                ]

                await createShowtimes(fix, createDtos)
            })

            it('returns showdates for the movieIds and theaterIds', async () => {
                const showdates = await fix.showtimesService.searchShowdates({
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
