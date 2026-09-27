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
        describe('상영 두 건이 존재하면', () => {
            let showtimes: ShowtimeDto[]

            beforeEach(async () => {
                showtimes = await createShowtimes(fix, [
                    { startTime: instant('2000-01-01T12:00Z') },
                    { startTime: instant('2000-01-01T14:00Z') }
                ])
            })

            it('두 ID로 조회하면 해당 상영들을 반환한다', async () => {
                const fetchedShowtimes = await showtimesService.getMany(pickIds(showtimes))

                expect(fetchedShowtimes).toEqual(expect.arrayContaining(showtimes))
            })

            describe('조회할 ID에 존재하지 않는 ID가 섞여 있으면', () => {
                let ids: Parameters<typeof showtimesService.getMany>[0]
                beforeEach(() => {
                    ids = [ensure(showtimes[0]).id, nullObjectId]
                })
                it('상영을 조회하면 404 예외를 던진다', async () => {
                    const promise = showtimesService.getMany(ids)

                    await expect(promise).rejects.toMatchObject({
                        message: Errors.Mongo.MultipleDocumentsNotFound([nullObjectId]).message,
                        status: HttpStatus.NOT_FOUND
                    })
                })
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

            describe('사가 식별자 목록을 검색 조건으로 지정했으면', () => {
                let query: Parameters<typeof showtimesService.search>[0]
                beforeEach(() => {
                    query = { sagaIds: [sagaId] }
                })
                it('검색하면 해당 ID에 속한 상영만 반환한다', async () => {
                    const showtimes = await showtimesService.search(query)

                    expect(showtimes).toEqual([showtimeForSaga])
                })
            })

            describe('영화 ID 목록을 검색 조건으로 지정했으면', () => {
                let query: Parameters<typeof showtimesService.search>[0]
                beforeEach(() => {
                    query = { movieIds: [movieId] }
                })
                it('검색하면 해당 ID에 속한 상영만 반환한다', async () => {
                    const showtimes = await showtimesService.search(query)

                    expect(showtimes).toEqual([showtimeForMovie])
                })
            })

            describe('극장 ID 목록을 검색 조건으로 지정했으면', () => {
                let query: Parameters<typeof showtimesService.search>[0]
                beforeEach(() => {
                    query = { theaterIds: [theaterId] }
                })
                it('검색하면 해당 ID에 속한 상영만 반환한다', async () => {
                    const showtimes = await showtimesService.search(query)

                    expect(showtimes).toEqual([showtimeForTheater])
                })
            })

            describe('상영 시작 시각의 범위를 검색 조건으로 지정했으면', () => {
                let query: Parameters<typeof showtimesService.search>[0]
                beforeEach(() => {
                    query = {
                        startTimeRange: {
                            end: instant('2020-01-02T12:00Z'),
                            start: instant('2020-01-01T00:00Z')
                        }
                    }
                })
                it('검색하면 해당 범위에서 시작하는 상영만 반환한다', async () => {
                    const showtimes = await showtimesService.search(query)

                    expect(showtimes).toHaveLength(2)
                    expect(showtimes).toEqual(
                        expect.arrayContaining([showtimeInRangeA, showtimeInRangeB])
                    )
                })
            })
        })

        describe('시작 시각과 다른 순서로 상영이 등록되어 있으면', () => {
            let sagaId: string
            beforeEach(async () => {
                sagaId = oid(0x9)

                // 삽입 순서를 일부러 뒤섞어 정렬 결과가 Mongo 자연 순서와 구분되게 한다
                await showtimesService.createMany([
                    buildCreateShowtimeDto({ sagaId, startTime: instant('2000-01-01T14:00Z') }),
                    buildCreateShowtimeDto({ sagaId, startTime: instant('2000-01-01T12:00Z') }),
                    buildCreateShowtimeDto({ sagaId, startTime: instant('2000-01-01T13:00Z') })
                ])
            })
            it('시작 시각이 빠른 순서로 반환한다', async () => {
                const showtimes = await showtimesService.search({ sagaIds: [sagaId] })

                expect(showtimes.map((showtime) => showtime.startTime)).toEqual([
                    instant('2000-01-01T12:00Z'),
                    instant('2000-01-01T13:00Z'),
                    instant('2000-01-01T14:00Z')
                ])
            })
        })

        describe('검색 조건이 비어 있으면', () => {
            let query: Parameters<typeof showtimesService.search>[0]
            beforeEach(() => {
                query = {}
            })
            it('상영을 검색하면 400 예외를 던진다', async () => {
                const promise = showtimesService.search(query)

                await expect(promise).rejects.toMatchObject({
                    message: Errors.Mongo.FiltersRequired().message,
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

        describe('상영 시작 범위의 시작점이 현재 시각이면', () => {
            let query: Parameters<typeof showtimesService.searchMovieIds>[0]
            beforeEach(() => {
                query = { startTimeRange: { start: DateUtil.now() } }
            })
            it('영화 ID를 조회하면 상영 예정인 영화의 ID를 반환한다', async () => {
                const movieIds = await showtimesService.searchMovieIds(query)

                expect(movieIds).toHaveLength(2)
                expect(movieIds).toEqual(expect.arrayContaining([oid(0x3), oid(0x4)]))
            })
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

        describe('영화 ID 목록을 검색 조건으로 지정했으면', () => {
            let query: Parameters<typeof showtimesService.searchTheaterIds>[0]
            beforeEach(() => {
                query = { movieIds: [oid(0xaa)] }
            })
            it('극장 ID를 조회하면 해당 영화를 상영하는 극장의 ID를 반환한다', async () => {
                const theaterIds = await showtimesService.searchTheaterIds(query)

                expect(theaterIds).toHaveLength(2)
                expect(theaterIds).toEqual(expect.arrayContaining([oid(0xb1), oid(0xb2)]))
            })
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

        describe('영화와 극장 ID 목록을 검색 조건으로 지정했으면', () => {
            let query: Parameters<typeof showtimesService.searchShowdates>[0]
            beforeEach(() => {
                query = { movieIds: [oid(0xa1)], theaterIds: [oid(0xb1)] }
            })
            it('상영일을 조회하면 조건에 맞는 날짜만 반환한다', async () => {
                const showdates = await showtimesService.searchShowdates(query)

                expect(showdates).toEqual([plainDate('2000-01-01'), plainDate('2000-01-02')])
            })
        })
    })
})
