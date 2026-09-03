import { DateUtil, ensure, pickIds } from '@mannercode/common'
import { instant, nullObjectId, oid, plainDate } from '@mannercode/testing'
import { HttpStatus } from '@nestjs/common'
import { type ShowtimeDto, ShowtimesService } from '#core'
import {
    buildCreateShowtimeDto,
    createShowtimes,
    Errors,
    type AppTestContext,
    createAppTestContext
} from '../helpers/index.js'

describe('ShowtimesService', () => {
    let fix: AppTestContext
    let teardown: AppTestContext['teardown'] | undefined
    let showtimesService: ShowtimesService

    beforeEach(async () => {
        teardown = undefined

        fix = await createAppTestContext()
        teardown = fix.teardown
        showtimesService = fix.module.get(ShowtimesService)
    })
    afterEach(() => teardown?.())

    describe('createMany', () => {
        it('생성된 상영 시간 수를 반환한다', async () => {
            const createDtos = [buildCreateShowtimeDto({ sagaId: oid(0x1) })]

            const { count } = await showtimesService.createMany(createDtos)

            expect(count).toBe(createDtos.length)
        })

        it('입력한 상영 시간을 DB에 저장한다', async () => {
            const createDtos = [
                buildCreateShowtimeDto({
                    sagaId: oid(0x1),
                    movieId: oid(0x2),
                    theaterId: oid(0x3),
                    startTime: instant('2020-01-01T12:00Z'),
                    endTime: instant('2020-01-01T14:00Z')
                })
            ]

            await showtimesService.createMany(createDtos)

            const saved = await showtimesService.search({ sagaIds: [oid(0x1)] })

            expect(saved).toHaveLength(createDtos.length)
            expect(saved).toEqual([
                {
                    id: expect.any(String),
                    movieId: oid(0x2),
                    theaterId: oid(0x3),
                    startTime: instant('2020-01-01T12:00Z'),
                    endTime: instant('2020-01-01T14:00Z')
                }
            ])
        })
    })

    describe('getMany', () => {
        it('주어진 상영 시간 ID 목록에 해당하는 상영 시간을 반환한다', async () => {
            const showtimes = await createShowtimes(fix, [
                { startTime: instant('2000-01-01T12:00Z') },
                { startTime: instant('2000-01-01T14:00Z') }
            ])

            const fetchedShowtimes = await showtimesService.getMany(pickIds(showtimes))

            expect(fetchedShowtimes).toEqual(expect.arrayContaining(showtimes))
        })

        it('상영 시간 ID 목록 중 하나라도 없으면 404를 던진다', async () => {
            const [existingShowtime] = await createShowtimes(fix, [
                { startTime: instant('2000-01-01T12:00Z') }
            ])

            const promise = showtimesService.getMany([ensure(existingShowtime).id, nullObjectId])

            await expect(promise).rejects.toMatchObject({
                message: Errors.Mongo.MultipleDocumentsNotFound([nullObjectId]).message,
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
                // search는 startTime 오름차순으로 반환하므로 위치 매핑이 흔들리지 않게 서로 다른 startTime을 준다
                const createdShowtimes = await createShowtimes(fix, [
                    { sagaId, startTime: instant('2000-01-01T12:00Z') },
                    { movieId, startTime: instant('2000-01-02T12:00Z') },
                    { theaterId, startTime: instant('2000-01-03T12:00Z') },
                    { startTime: instant('2020-01-01T12:00Z') },
                    { startTime: instant('2020-01-01T14:00Z') },
                    { startTime: instant('2020-01-02T14:00Z') },
                    { startTime: instant('2020-01-03T12:00Z') }
                ])

                showtimeForSaga = ensure(createdShowtimes[0])
                showtimeForMovie = ensure(createdShowtimes[1])
                showtimeForTheater = ensure(createdShowtimes[2])
                showtimeInRangeA = ensure(createdShowtimes[3])
                showtimeInRangeB = ensure(createdShowtimes[4])
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
                        end: instant('2020-01-02T12:00Z'),
                        start: instant('2020-01-01T00:00Z')
                    }
                })

                expect(showtimes).toHaveLength(2)
                expect(showtimes).toEqual(
                    expect.arrayContaining([showtimeInRangeA, showtimeInRangeB])
                )
            })
        })

        it('결과를 startTime 오름차순으로 정렬해 반환한다', async () => {
            const sagaId = oid(0x9)

            // 삽입 순서를 일부러 뒤섞어 정렬 결과가 Mongo 자연 순서와 구분되게 한다
            await showtimesService.createMany([
                buildCreateShowtimeDto({ sagaId, startTime: instant('2000-01-01T14:00Z') }),
                buildCreateShowtimeDto({ sagaId, startTime: instant('2000-01-01T12:00Z') }),
                buildCreateShowtimeDto({ sagaId, startTime: instant('2000-01-01T13:00Z') })
            ])

            const showtimes = await showtimesService.search({ sagaIds: [sagaId] })

            expect(showtimes.map((showtime) => showtime.startTime)).toEqual([
                instant('2000-01-01T12:00Z'),
                instant('2000-01-01T13:00Z'),
                instant('2000-01-01T14:00Z')
            ])
        })

        it('필터가 비어 있으면 400을 던진다', async () => {
            const promise = showtimesService.search({})

            await expect(promise).rejects.toMatchObject({
                message: Errors.Mongo.FiltersRequired().message,
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
                startTimeRange: { start: DateUtil.now() }
            })

            expect(movieIds).toHaveLength(2)
            expect(movieIds).toEqual(expect.arrayContaining([oid(0x3), oid(0x4)]))
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

            expect(theaterIds).toHaveLength(2)
            expect(theaterIds).toEqual(expect.arrayContaining([oid(0xb1), oid(0xb2)]))
        })
    })

    describe('searchShowdates', () => {
        beforeEach(async () => {
            await createShowtimes(fix, [
                {
                    movieId: oid(0xa1),
                    startTime: instant('2000-01-01T00:00Z'),
                    theaterId: oid(0xb1)
                },
                {
                    movieId: oid(0xa1),
                    startTime: instant('2000-01-02T00:00Z'),
                    theaterId: oid(0xb1)
                },
                {
                    movieId: oid(0xa1),
                    startTime: instant('2000-01-03T00:00Z'),
                    theaterId: oid(0x00)
                }
            ])
        })

        it('영화 ID 목록과 극장 ID 목록으로 필터링한 상영 날짜를 반환한다', async () => {
            const showdates = await showtimesService.searchShowdates({
                movieIds: [oid(0xa1)],
                theaterIds: [oid(0xb1)]
            })

            expect(showdates).toEqual([plainDate('2000-01-01'), plainDate('2000-01-02')])
        })
    })
})
