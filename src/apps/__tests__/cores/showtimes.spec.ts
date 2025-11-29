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
        describe('when the payload is valid', () => {
            it('creates showtimes and returns the result', async () => {
                const createDtos = [buildCreateShowtimeDto({ transactionId: oid(0x1) })]

                const { success } = await fixture.showtimesService.createMany(createDtos)

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

                showtimes = await createShowtimes(fixture, createDtos)
            })

            it('returns the showtimes', async () => {
                const showtimeIds = pickIds(showtimes)

                const gotShowtimes = await fixture.showtimesService.getMany(showtimeIds)

                expect(gotShowtimes).toEqual(expect.arrayContaining(showtimes))
            })
        })

        describe('when the showtimes do not exist', () => {
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

        describe('when the `transactionIds` are provided', () => {
            it('returns showtimes for the transactionIds', async () => {
                const showtimes = await fixture.showtimesService.search({
                    transactionIds: [transactionId]
                })

                expect(showtimes).toEqual([createdShowtimes[0]])
            })
        })

        describe('when the `movieIds` are provided', () => {
            it('returns showtimes for the movieIds', async () => {
                const showtimes = await fixture.showtimesService.search({ movieIds: [movieId] })

                expect(showtimes).toEqual([createdShowtimes[1]])
            })
        })

        describe('when the `theaterIds` are provided', () => {
            it('returns showtimes for the theaterIds', async () => {
                const showtimes = await fixture.showtimesService.search({ theaterIds: [theaterId] })

                expect(showtimes).toEqual([createdShowtimes[2]])
            })
        })

        describe('when the `startTimeRange` is provided', () => {
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

        describe('when the filter is empty', () => {
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

        describe('when the `movieIds` are provided', () => {
            beforeEach(async () => {
                const createDtos = [
                    { movieId, theaterId: oid(0x1) },
                    { movieId, theaterId: oid(0x2) },
                    { movieId: oid(0x0), theaterId: oid(0x3) }
                ]

                await createShowtimes(fixture, createDtos)
            })

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

        describe('when the `movieIds` and `theaterIds` are provided', () => {
            beforeEach(async () => {
                const createDtos = [
                    { movieId, theaterId, startTime: new Date('2000-01-01') },
                    { movieId, theaterId, startTime: new Date('2000-01-02') },
                    { movieId, theaterId: oid(0x0), startTime: new Date('2000-01-03') }
                ]

                await createShowtimes(fixture, createDtos)
            })

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
