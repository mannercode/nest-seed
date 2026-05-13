import type { ShowtimeDto, ShowtimesService } from 'core'
import { DateUtil, pickIds } from '@mannercode/common'
import { nullObjectId, oid } from '@mannercode/testing'
import { HttpStatus } from '@nestjs/common'
import { buildCreateShowtimeDto, createShowtimes, Errors, type AppTestContext } from '../helpers'

describe('ShowtimesService', () => {
    let fix: AppTestContext
    let showtimesService: ShowtimesService

    beforeEach(async () => {
        const { createAppTestContext } = await import('../helpers')
        const { ShowtimesService } = await import('core')
        fix = await createAppTestContext()
        showtimesService = fix.module.get(ShowtimesService)
    })
    afterEach(() => fix.teardown())

    describe('deleteBySagaIds', () => {
        it('사가 식별자 목록에 해당하는 상영 시간을 삭제한다', async () => {
            const sagaId = oid(0x1)

            await showtimesService.createMany([buildCreateShowtimeDto({ sagaId })])
            await showtimesService.deleteBySagaIds([sagaId])

            const showtimes = await showtimesService.search({ sagaIds: [sagaId] })

            expect(showtimes).toHaveLength(0)
        })
    })

    describe('createMany', () => {
        it('생성된 상영 시간 수를 반환한다', async () => {
            const createDtos = [buildCreateShowtimeDto({ sagaId: oid(0x1) })]

            const { count } = await showtimesService.createMany(createDtos)

            expect(count).toBe(createDtos.length)
        })
    })

    describe('getMany', () => {
        it('주어진 상영 시간 ID 목록에 해당하는 상영 시간을 반환한다', async () => {
            const showtimes = await createShowtimes(fix, [
                { startTime: new Date('2000-01-01T12:00') },
                { startTime: new Date('2000-01-01T14:00') }
            ])

            const fetchedShowtimes = await showtimesService.getMany(pickIds(showtimes))

            expect(fetchedShowtimes).toEqual(expect.arrayContaining(showtimes))
        })

        it('상영 시간 ID 목록 중 하나라도 없으면 404를 던진다', async () => {
            const promise = showtimesService.getMany([nullObjectId])

            await expect(promise).rejects.toMatchObject({
                message: Errors.Mongoose.MultipleDocumentsNotFound([nullObjectId]).message,
                status: HttpStatus.NOT_FOUND
            })
        })
    })

    describe('search', () => {
        describe('id/시간 필터링', () => {
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

            it('사가 식별자 목록으로 필터링한다', async () => {
                const showtimes = await showtimesService.search({ sagaIds: [sagaId] })

                expect(showtimes).toEqual([showtimeForSaga])
            })

            it('영화 ID 목록으로 필터링한다', async () => {
                const showtimes = await showtimesService.search({ movieIds: [movieId] })

                expect(showtimes).toEqual([showtimeForMovie])
            })

            it('극장 ID 목록으로 필터링한다', async () => {
                const showtimes = await showtimesService.search({ theaterIds: [theaterId] })

                expect(showtimes).toEqual([showtimeForTheater])
            })

            it('상영 시작 범위로 필터링한다', async () => {
                const showtimes = await showtimesService.search({
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

        it('필터가 비어 있으면 400을 던진다', async () => {
            const promise = showtimesService.search({})

            await expect(promise).rejects.toMatchObject({
                message: Errors.Mongoose.FiltersRequired().message,
                status: HttpStatus.BAD_REQUEST
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

        it('상영 시작 범위로 필터링한 영화 ID 목록을 반환한다', async () => {
            const movieIds = await showtimesService.searchMovieIds({
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

        it('영화 ID 목록으로 필터링한 극장 ID 목록을 반환한다', async () => {
            const theaterIds = await showtimesService.searchTheaterIds({ movieIds: [oid(0xaa)] })

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

        it('영화 ID 목록과 극장 ID 목록으로 필터링한 상영 날짜를 반환한다', async () => {
            const showdates = await showtimesService.searchShowdates({
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
