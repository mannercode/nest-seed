import type { ShowtimeDto } from 'cores'
import { DateUtil, pickIds } from '@mannercode/common'
import { nullObjectId, oid } from '@mannercode/testing'
import { HttpStatus } from '@nestjs/common'
import type { ShowtimesFixture } from './showtimes.fixture'
import { buildCreateShowtimeDto, createShowtimes, Errors } from '../__helpers__'

describe('ShowtimesService', () => {
    let fix: ShowtimesFixture

    beforeEach(async () => {
        const { createShowtimesFixture } = await import('./showtimes.fixture')
        fix = await createShowtimesFixture()
    })
    afterEach(() => fix.teardown())

    describe('deleteBySagaIds', () => {
        it('sagaIds에 해당하는 상영 시간을 삭제한다', async () => {
            const sagaId = oid(0x1)

            await fix.showtimesService.createMany([buildCreateShowtimeDto({ sagaId })])
            await fix.showtimesService.deleteBySagaIds([sagaId])

            const showtimes = await fix.showtimesService.search({ sagaIds: [sagaId] })

            expect(showtimes).toHaveLength(0)
        })
    })

    describe('createMany', () => {
        it('생성된 상영 시간 수를 반환한다', async () => {
            const createDtos = [buildCreateShowtimeDto({ sagaId: oid(0x1) })]

            const { count } = await fix.showtimesService.createMany(createDtos)

            expect(count).toBe(createDtos.length)
        })
    })

    describe('getMany', () => {
        describe('상영 시간이 존재할 때', () => {
            let showtimes: ShowtimeDto[]

            beforeEach(async () => {
                showtimes = await createShowtimes(fix, [
                    { startTime: new Date('2000-01-01T12:00') },
                    { startTime: new Date('2000-01-01T14:00') }
                ])
            })

            it('showtimeIds에 대한 상영 시간을 반환한다', async () => {
                const fetchedShowtimes = await fix.showtimesService.getMany(pickIds(showtimes))

                expect(fetchedShowtimes).toEqual(expect.arrayContaining(showtimes))
            })
        })

        describe('showtimeIds에 존재하지 않는 showtimeId가 포함될 때', () => {
            it('404 Not Found를 던진다', async () => {
                const promise = fix.showtimesService.getMany([nullObjectId])

                await expect(promise).rejects.toMatchObject({
                    message: Errors.Mongoose.MultipleDocumentsNotFound([nullObjectId]).message,
                    status: HttpStatus.NOT_FOUND
                })
            })
        })
    })

    describe('search', () => {
        describe('필터가 제공될 때', () => {
            const sagaId = oid(0x1)
            const movieId = oid(0x2)
            const theaterId = oid(0x3)
            let showtimeForSaga: ShowtimeDto
            let showtimeForMovie: ShowtimeDto
            let showtimeForTheater: ShowtimeDto
            let showtimeInRangeA: ShowtimeDto
            let showtimeInRangeB: ShowtimeDto

            beforeEach(async () => {
                const createdShowtimes = await createShowtimes(fix, [
                    { sagaId },
                    { movieId },
                    { theaterId },
                    { startTime: new Date('2020-01-01T12:00') },
                    { startTime: new Date('2020-01-01T14:00') },
                    { startTime: new Date('2020-01-02T14:00') },
                    { startTime: new Date('2020-01-03T12:00') }
                ])

                showtimeForSaga = createdShowtimes[0]
                showtimeForMovie = createdShowtimes[1]
                showtimeForTheater = createdShowtimes[2]
                showtimeInRangeA = createdShowtimes[3]
                showtimeInRangeB = createdShowtimes[4]
            })

            it('sagaIds로 필터링된 상영 시간을 반환한다', async () => {
                const showtimes = await fix.showtimesService.search({ sagaIds: [sagaId] })

                expect(showtimes).toEqual([showtimeForSaga])
            })

            it('movieIds로 필터링된 상영 시간을 반환한다', async () => {
                const showtimes = await fix.showtimesService.search({ movieIds: [movieId] })

                expect(showtimes).toEqual([showtimeForMovie])
            })

            it('theaterIds로 필터링된 상영 시간을 반환한다', async () => {
                const showtimes = await fix.showtimesService.search({ theaterIds: [theaterId] })

                expect(showtimes).toEqual([showtimeForTheater])
            })

            it('startTimeRange로 필터링된 상영 시간을 반환한다', async () => {
                const showtimes = await fix.showtimesService.search({
                    startTimeRange: {
                        end: new Date('2020-01-02T12:00'),
                        start: new Date('2020-01-01T00:00')
                    }
                })

                expect(showtimes).toHaveLength(2)
                expect(showtimes).toEqual(
                    expect.arrayContaining([showtimeInRangeA, showtimeInRangeB])
                )
            })
        })

        describe('필터가 비어 있을 때', () => {
            it('400 Bad Request를 던진다', async () => {
                const promise = fix.showtimesService.search({})

                await expect(promise).rejects.toMatchObject({
                    message: Errors.Mongoose.FiltersRequired().message,
                    status: HttpStatus.BAD_REQUEST
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

        it('startTimeRange로 필터링된 movieIds를 반환한다', async () => {
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

        it('movieIds로 필터링된 theaterIds를 반환한다', async () => {
            const theaterIds = await fix.showtimesService.searchTheaterIds({
                movieIds: [oid(0xaa)]
            })

            expect(theaterIds).toEqual([oid(0xb1), oid(0xb2)])
        })
    })

    describe('searchShowdates', () => {
        beforeEach(async () => {
            await createShowtimes(fix, [
                { movieId: oid(0xa1), startTime: new Date('2000-01-01'), theaterId: oid(0xb1) },
                { movieId: oid(0xa1), startTime: new Date('2000-01-02'), theaterId: oid(0xb1) },
                { movieId: oid(0xa1), startTime: new Date('2000-01-03'), theaterId: oid(0x00) }
            ])
        })

        it('movieIds와 theaterIds로 필터링된 상영 날짜를 반환한다', async () => {
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
