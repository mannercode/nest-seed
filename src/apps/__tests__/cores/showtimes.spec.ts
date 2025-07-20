import { ShowtimeDto } from 'apps/cores'
import { DateUtil, pickIds } from 'common'
import { expectEqualUnsorted, nullObjectId, testObjectId } from 'testlib'
import { buildCreateShowtimeDto, createShowtimes } from '../common.fixture'
import { buildCreateShowtimeDtos, Fixture } from './showtimes.fixture'

describe('ShowtimesService', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./showtimes.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('createShowtimes()', () => {
        // 새로운 상영시간을 성공적으로 생성한다.
        it('creates new showtimes successfully', async () => {
            const { createDto, expectedDto } = buildCreateShowtimeDto({
                transactionId: testObjectId(0x1)
            })

            const { success } = await fix.showtimesClient.createShowtimes([createDto])
            expect(success).toBeTruthy()

            const showtimes = await fix.showtimesClient.searchShowtimes({
                transactionIds: [testObjectId(0x1)]
            })

            expect(showtimes).toEqual([expectedDto])
        })
    })

    describe('searchShowtimes()', () => {
        const transactionId = testObjectId(0x1)
        const movieId = testObjectId(0x2)
        const theaterId = testObjectId(0x3)
        const startTimes = [
            new Date('2000-01-01T12:00'),
            new Date('2000-01-01T14:00'),
            new Date('2000-01-02T14:00'),
            new Date('2000-01-03T12:00')
        ]
        let expectedDtos: ShowtimeDto[]

        beforeEach(async () => {
            const result = buildCreateShowtimeDtos(startTimes, {
                transactionId,
                movieId,
                theaterId
            })
            const { success } = await fix.showtimesClient.createShowtimes(result.createDtos)
            expect(success).toBeTruthy()
            expectedDtos = result.expectedDtos
        })

        // 다양한 조건으로 필터링할 때
        describe('when filtering with various criteria', () => {
            // transaction ID로 필터링된 상영시간 목록을 반환한다.
            it('returns showtimes filtered by transaction IDs', async () => {
                const showtimes = await fix.showtimesClient.searchShowtimes({
                    transactionIds: [transactionId]
                })
                expectEqualUnsorted(showtimes, expectedDtos)
            })

            // movie ID로 필터링된 상영시간 목록을 반환한다.
            it('returns showtimes filtered by movie IDs', async () => {
                const showtimes = await fix.showtimesClient.searchShowtimes({ movieIds: [movieId] })
                expectEqualUnsorted(showtimes, expectedDtos)
            })

            // theater ID로 필터링된 상영시간 목록을 반환한다.
            it('returns showtimes filtered by theater IDs', async () => {
                const showtimes = await fix.showtimesClient.searchShowtimes({
                    theaterIds: [theaterId]
                })
                expectEqualUnsorted(showtimes, expectedDtos)
            })

            // 시작 시간 범위로 필터링된 상영시간 목록을 반환한다.
            it('returns showtimes filtered by a start time range', async () => {
                const startTimeRange = {
                    start: new Date('2000-01-01T00:00'),
                    end: new Date('2000-01-02T12:00')
                }
                const showtimes = await fix.showtimesClient.searchShowtimes({ startTimeRange })
                expect(showtimes).toHaveLength(2)
            })
        })

        // 필터 조건이 제공되지 않았을 때
        describe('when no filter is provided', () => {
            // 에러를 던진다.
            it('throws an error', async () => {
                const promise = fix.showtimesClient.searchShowtimes({})
                await expect(promise).rejects.toThrow(
                    'At least one filter condition must be provided'
                )
            })
        })
    })

    describe('getShowtimes()', () => {
        let showtimes: ShowtimeDto[]

        beforeEach(async () => {
            const { createDtos } = buildCreateShowtimeDtos([
                new Date('2000-01-01T12:00'),
                new Date('2000-01-01T14:00')
            ])
            showtimes = await createShowtimes(fix, createDtos)
        })

        // 상영시간이 존재할 때
        describe('when the showtimes exist', () => {
            // 해당하는 상영시간의 상세 정보를 반환한다.
            it('returns the corresponding showtime details', async () => {
                const gotShowtimes = await fix.showtimesClient.getShowtimes(pickIds(showtimes))
                expectEqualUnsorted(gotShowtimes, showtimes)
            })
        })

        // 상영시간 중 일부가 존재하지 않을 때
        describe('when any showtime does not exist', () => {
            // "문서를 찾을 수 없음" 에러를 던진다.
            it('throws a "document not found" error', async () => {
                const promise = fix.showtimesClient.getShowtimes([nullObjectId])
                await expect(promise).rejects.toThrow('One or more documents not found')
            })
        })
    })

    describe('searchShowingMovieIds()', () => {
        // 현재 상영 중이거나 곧 상영될 영화의 ID 목록을 반환한다.
        it('returns the IDs of movies currently or soon to be showing', async () => {
            const now = new Date()
            const buildCreateDto = (movieId: string, startTime: Date) =>
                buildCreateShowtimeDto({
                    movieId,
                    startTime,
                    endTime: DateUtil.addMinutes(startTime, 1)
                }).createDto

            const createDtos = [
                buildCreateDto(testObjectId(0x1), DateUtil.addMinutes(now, -90)), // 과거
                buildCreateDto(testObjectId(0x2), DateUtil.addMinutes(now, 30)), // 미래
                buildCreateDto(testObjectId(0x3), DateUtil.addMinutes(now, 120)) // 미래
            ]
            await fix.showtimesClient.createShowtimes(createDtos)

            const foundMovieIds = await fix.showtimesClient.searchShowingMovieIds()
            expect(foundMovieIds).toEqual([testObjectId(0x2), testObjectId(0x3)])
        })
    })

    describe('searchTheaterIds()', () => {
        // 특정 영화를 상영하는 영화관의 ID 목록을 반환한다.
        it('returns theater IDs that are showing a specific movie', async () => {
            const movieId = testObjectId(0x10)
            const buildCreateDto = (movieId: string, theaterId: string) =>
                buildCreateShowtimeDto({ movieId, theaterId }).createDto

            const createDtos = [
                buildCreateDto(movieId, testObjectId(0x1)),
                buildCreateDto(movieId, testObjectId(0x2)),
                buildCreateDto(nullObjectId, testObjectId(0x3)) // 다른 영화
            ]
            await fix.showtimesClient.createShowtimes(createDtos)

            const foundTheaterIds = await fix.showtimesClient.searchTheaterIds({
                movieIds: [movieId]
            })
            expect(foundTheaterIds).toEqual([testObjectId(0x1), testObjectId(0x2)])
        })
    })

    describe('searchShowdates()', () => {
        // 특정 영화와 영화관의 상영 가능 날짜 목록을 반환한다.
        it('returns available show dates for a specific movie and theater', async () => {
            const movieId = testObjectId(0x1)
            const theaterId = testObjectId(0x2)
            const buildCreateDto = (theaterId: string, startTime: Date) =>
                buildCreateShowtimeDto({ movieId, theaterId, startTime, endTime: startTime })
                    .createDto

            const createDtos = [
                buildCreateDto(theaterId, new Date('2000-01-01')),
                buildCreateDto(theaterId, new Date('2000-01-02')),
                buildCreateDto(nullObjectId, new Date('2000-01-03')) // 다른 영화관
            ]
            await fix.showtimesClient.createShowtimes(createDtos)

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
