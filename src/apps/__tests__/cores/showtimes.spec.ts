import type { ShowtimeDto } from 'apps/cores'
import { HttpStatus } from '@nestjs/common'
import { buildCreateShowtimeDto, createShowtimes, Errors } from 'apps/__tests__/__helpers__'
import { DateUtil, pickIds } from 'common'
import { nullObjectId, oid } from 'testlib'
import type { ShowtimesFixture } from './showtimes.fixture'

describe('ShowtimesService', () => {
    let fix: ShowtimesFixture

    beforeEach(async () => {
        const { createShowtimesFixture } = await import('./showtimes.fixture')
        fix = await createShowtimesFixture()
    })
    afterEach(() => fix.teardown())

    describe('deleteBySagaIds', () => {
        // sagaIds에 해당하는 상영 시간을 삭제한다
        it('deletes showtimes by sagaIds', async () => {
            const sagaId = oid(0x1)

            await fix.showtimesClient.createMany([buildCreateShowtimeDto({ sagaId })])
            await fix.showtimesClient.deleteBySagaIds([sagaId])

            const showtimes = await fix.showtimesClient.search({ sagaIds: [sagaId] })

            expect(showtimes).toHaveLength(0)
        })
    })

    describe('createMany', () => {
        // 상영 시간을 생성한다
        it('creates showtimes', async () => {
            const createDtos = [buildCreateShowtimeDto({ sagaId: oid(0x1) })]

            const { success } = await fix.showtimesClient.createMany(createDtos)

            expect(success).toBe(true)
        })
    })

    describe('getMany', () => {
        // 상영 시간이 존재할 때
        describe('when the showtimes exist', () => {
            let showtimes: ShowtimeDto[]

            beforeEach(async () => {
                showtimes = await createShowtimes(fix, [
                    { startTime: new Date('2000-01-01T12:00') },
                    { startTime: new Date('2000-01-01T14:00') }
                ])
            })

            // showtimeIds에 대한 상영 시간을 반환한다
            it('returns showtimes for the showtimeIds', async () => {
                const fetchedShowtimes = await fix.showtimesClient.getMany(pickIds(showtimes))

                expect(fetchedShowtimes).toEqual(expect.arrayContaining(showtimes))
            })
        })

        // showtimeIds에 존재하지 않는 showtimeId가 포함될 때
        describe('when the showtimeIds include a non-existent showtimeId', () => {
            // 404 Not Found를 던진다
            it('throws 404 Not Found', async () => {
                const promise = fix.showtimesClient.getMany([nullObjectId])

                await expect(promise).rejects.toMatchObject({
                    message: Errors.Mongoose.MultipleDocumentsNotFound([nullObjectId]).message,
                    status: HttpStatus.NOT_FOUND
                })
            })
        })
    })

    describe('search', () => {
        // 필터가 제공될 때
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

            // sagaIds로 필터링된 상영 시간을 반환한다
            it('returns showtimes filtered by sagaIds', async () => {
                const showtimes = await fix.showtimesClient.search({ sagaIds: [sagaId] })

                expect(showtimes).toEqual([showtimeForSaga])
            })

            // movieIds로 필터링된 상영 시간을 반환한다
            it('returns showtimes filtered by movieIds', async () => {
                const showtimes = await fix.showtimesClient.search({ movieIds: [movieId] })

                expect(showtimes).toEqual([showtimeForMovie])
            })

            // theaterIds로 필터링된 상영 시간을 반환한다
            it('returns showtimes filtered by theaterIds', async () => {
                const showtimes = await fix.showtimesClient.search({ theaterIds: [theaterId] })

                expect(showtimes).toEqual([showtimeForTheater])
            })

            // startTimeRange로 필터링된 상영 시간을 반환한다
            it('returns showtimes filtered by startTimeRange', async () => {
                const showtimes = await fix.showtimesClient.search({
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

        // 필터가 비어 있을 때
        describe('when the filter is empty', () => {
            // 400 Bad Request를 던진다
            it('throws 400 Bad Request', async () => {
                const promise = fix.showtimesClient.search({})

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

        // startTimeRange로 필터링된 movieIds를 반환한다
        it('returns movieIds filtered by startTimeRange', async () => {
            const movieIds = await fix.showtimesClient.searchMovieIds({
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

        // movieIds로 필터링된 theaterIds를 반환한다
        it('returns theaterIds filtered by movieIds', async () => {
            const theaterIds = await fix.showtimesClient.searchTheaterIds({ movieIds: [oid(0xaa)] })

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

        // movieIds와 theaterIds로 필터링된 상영 날짜를 반환한다
        it('returns showdates filtered by movieIds and theaterIds', async () => {
            const showdates = await fix.showtimesClient.searchShowdates({
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
