import { HttpStatus } from '@nestjs/common'
import type { ShowtimeDto } from 'apps/cores'
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
        await fix.teardown()
    })

    describe('createMany', () => {
        it('creates showtimes', async () => {
            const createDtos = [buildCreateShowtimeDto({ sagaId: oid(0x1) })]

            const { success } = await fix.showtimesService.createMany(createDtos)

            expect(success).toBe(true)
        })
    })

    describe('getMany', () => {
        describe('when the showtimes exist', () => {
            let showtimes: ShowtimeDto[]

            beforeEach(async () => {
                showtimes = await createShowtimes(fix, [
                    { startTime: new Date('2000-01-01T12:00') },
                    { startTime: new Date('2000-01-01T14:00') }
                ])
            })

            it('returns showtimes for the showtimeIds', async () => {
                const fetchedShowtimes = await fix.showtimesService.getMany(pickIds(showtimes))

                expect(fetchedShowtimes).toEqual(expect.arrayContaining(showtimes))
            })
        })

        describe('when the showtimeIds include a non-existent showtimeId', () => {
            it('throws 404 Not Found', async () => {
                const promise = fix.showtimesService.getMany([nullObjectId])

                await expect(promise).rejects.toMatchObject({
                    status: HttpStatus.NOT_FOUND,
                    message: Errors.Mongoose.MultipleDocumentsNotFound.message
                })
            })
        })
    })

    describe('search', () => {
        describe('when the filter is provided', () => {
            const sagaId = oid(0x1)
            const movieId = oid(0x2)
            const theaterId = oid(0x3)
            let showtimeForSaga: ShowtimeDto
            let showtimeForMovie: ShowtimeDto
            let showtimeForTheater: ShowtimeDto
            let showtimeInRangeA: ShowtimeDto
            let showtimeInRangeB: ShowtimeDto

            beforeEach(async () => {
                ;[
                    showtimeForSaga,
                    showtimeForMovie,
                    showtimeForTheater,
                    showtimeInRangeA,
                    showtimeInRangeB
                ] = await createShowtimes(fix, [
                    { sagaId },
                    { movieId },
                    { theaterId },
                    { startTime: new Date('2020-01-01T12:00') },
                    { startTime: new Date('2020-01-01T14:00') },
                    { startTime: new Date('2020-01-02T14:00') },
                    { startTime: new Date('2020-01-03T12:00') }
                ])
            })

            it('returns showtimes filtered by sagaIds', async () => {
                const showtimes = await fix.showtimesService.search({ sagaIds: [sagaId] })

                expect(showtimes).toEqual([showtimeForSaga])
            })

            it('returns showtimes filtered by movieIds', async () => {
                const showtimes = await fix.showtimesService.search({ movieIds: [movieId] })

                expect(showtimes).toEqual([showtimeForMovie])
            })

            it('returns showtimes filtered by theaterIds', async () => {
                const showtimes = await fix.showtimesService.search({ theaterIds: [theaterId] })

                expect(showtimes).toEqual([showtimeForTheater])
            })

            it('returns showtimes filtered by startTimeRange', async () => {
                const showtimes = await fix.showtimesService.search({
                    startTimeRange: {
                        start: new Date('2020-01-01T00:00'),
                        end: new Date('2020-01-02T12:00')
                    }
                })

                expect(showtimes).toHaveLength(2)
                expect(showtimes).toEqual(
                    expect.arrayContaining([showtimeInRangeA, showtimeInRangeB])
                )
            })
        })

        describe('when the filter is empty', () => {
            it('throws 400 Bad Request', async () => {
                const promise = fix.showtimesService.search({})

                await expect(promise).rejects.toMatchObject({
                    status: HttpStatus.BAD_REQUEST,
                    message: Errors.Mongoose.FiltersRequired.message
                })
            })
        })
    })

    describe('searchMovieIds', () => {
        beforeEach(async () => {
            await createShowtimes(fix, [
                { movieId: oid(0x1), startTime: DateUtil.add({ minutes: -90 }) },
                { movieId: oid(0x2), startTime: DateUtil.add({ minutes: 0 }) },
                { movieId: oid(0x3), startTime: DateUtil.add({ minutes: 1 }) },
                { movieId: oid(0x4), startTime: DateUtil.add({ minutes: 120 }) }
            ])
        })

        it('returns movieIds filtered by startTimeRange', async () => {
            const movieIds = await fix.showtimesService.searchMovieIds({
                startTimeRange: { start: new Date() }
            })

            expect(movieIds).toEqual([oid(0x3), oid(0x4)])
        })
    })

    describe('searchTheaterIds', () => {
        beforeEach(async () => {
            await createShowtimes(fix, [
                { movieId: oid(0xaa), theaterId: oid(0xb1) },
                { movieId: oid(0xaa), theaterId: oid(0xb2) },
                { movieId: oid(0x00), theaterId: oid(0xb3) }
            ])
        })

        it('returns theaterIds filtered by movieIds', async () => {
            const theaterIds = await fix.showtimesService.searchTheaterIds({
                movieIds: [oid(0xaa)]
            })

            expect(theaterIds).toEqual([oid(0xb1), oid(0xb2)])
        })
    })

    describe('searchShowdates', () => {
        beforeEach(async () => {
            await createShowtimes(fix, [
                { movieId: oid(0xa1), theaterId: oid(0xb1), startTime: new Date('2000-01-01') },
                { movieId: oid(0xa1), theaterId: oid(0xb1), startTime: new Date('2000-01-02') },
                { movieId: oid(0xa1), theaterId: oid(0x00), startTime: new Date('2000-01-03') }
            ])
        })

        it('returns showdates filtered by movieIds and theaterIds', async () => {
            const showdates = await fix.showtimesService.searchShowdates({
                movieIds: [oid(0xa1)],
                theaterIds: [oid(0xb1)]
            })

            expect(showdates.map((d) => d.getTime())).toEqual([
                new Date('2000-01-01').getTime(),
                new Date('2000-01-02').getTime()
            ])
        })
    })
})
