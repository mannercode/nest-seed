import { MovieDto } from 'services/movies'
import { ShowtimeDto, ShowtimesService } from 'services/showtimes'
import { getSeatCount, TheaterDto } from 'services/theaters'
import { expectEqualUnsorted, HttpTestClient } from 'testlib'
import {
    closeIsolatedFixture,
    createIsolatedFixture,
    createShowtimeDtos,
    IsolatedFixture,
    monitorEvents,
    createBatchShowtimes
} from './showtime-creation.fixture'
import { createShowtimes } from './showtimes.fixture'
import { nullObjectId } from 'common'

describe('ShowtimeCreation', () => {
    let isolated: IsolatedFixture
    let client: HttpTestClient
    let showtimesService: ShowtimesService
    let movie: MovieDto
    let theater: TheaterDto

    beforeEach(async () => {
        isolated = await createIsolatedFixture()
        client = isolated.testContext.client
        showtimesService = isolated.showtimesService
        movie = isolated.movie
        theater = isolated.theater
    })

    afterEach(async () => {
        await closeIsolatedFixture(isolated)
    })

    it('영화 목록 요청', async () => {
        const { body } = await client.get('/showtime-creation/movies').query({ skip: 0 }).ok()
        const { items, ...paginated } = body

        expect(paginated).toEqual({ skip: 0, take: expect.any(Number), total: 1 })
        expect(items).toEqual([movie])
    })

    it('극장 목록 요청', async () => {
        const { body } = await client.get('/showtime-creation/theaters').query({ skip: 0 }).ok()
        const { items, ...paginated } = body

        expect(paginated).toEqual({ skip: 0, take: expect.any(Number), total: 1 })
        expect(items).toEqual([theater])
    })

    describe('상영시간 목록 요청', () => {
        let showtimes: ShowtimeDto[]

        beforeEach(async () => {
            const createDtos = createShowtimeDtos(
                [
                    new Date('2100-01-01T09:00'),
                    new Date('2100-01-01T11:00'),
                    new Date('2100-01-01T13:00')
                ],
                { theaterId: theater.id }
            )

            showtimes = await createShowtimes(showtimesService, createDtos)
        })

        it('예정된 상영시간 목록을 반환해야 한다', async () => {
            const { body } = await client
                .post('/showtime-creation/showtimes/find')
                .body({ theaterIds: [theater.id] })
                .ok()

            expectEqualUnsorted(body, showtimes)
        })
    })

    describe('상영시간 등록 요청', () => {
        it('상영시간 등록 요청이 성공해야 한다', async () => {
            const monitorPromise = monitorEvents(client, ['complete'])

            const theaterIds = [theater.id]
            const startTimes = [
                new Date('2100-01-01T09:00'),
                new Date('2100-01-01T11:00'),
                new Date('2100-01-01T13:00')
            ]

            const { batchId } = await createBatchShowtimes(
                client,
                movie.id,
                theaterIds,
                startTimes,
                90
            )

            expect(batchId).toBeDefined()

            const seatCount = getSeatCount(theater.seatmap)
            const showtimeCreatedCount = theaterIds.length * startTimes.length
            const ticketCreatedCount = showtimeCreatedCount * seatCount

            await expect(monitorPromise).resolves.toEqual({
                batchId,
                status: 'complete',
                showtimeCreatedCount,
                ticketCreatedCount
            })
        })

        it('movie가 존재하지 않으면 작업 요청이 실패해야 한다', async () => {
            const monitorPromise = monitorEvents(client, ['error'])

            const { batchId } = await createBatchShowtimes(
                client,
                nullObjectId,
                [theater.id],
                [new Date(0)],
                90
            )

            await expect(monitorPromise).resolves.toEqual({
                batchId,
                status: 'error',
                message: 'Movie with ID 000000000000000000000000 not found'
            })
        })

        it('theater가 존재하지 않으면 작업 요청이 실패해야 한다', async () => {
            const monitorPromise = monitorEvents(client, ['error'])

            const { batchId } = await createBatchShowtimes(
                client,
                movie.id,
                [nullObjectId],
                [new Date(0)],
                90
            )

            await expect(monitorPromise).resolves.toEqual({
                batchId,
                status: 'error',
                message: 'Some of the theater IDs [000000000000000000000000] do not exist'
            })
        })
    })

    describe('상영시간 충돌 점검', () => {
        let showtimes: ShowtimeDto[]

        beforeEach(async () => {
            const createDtos = createShowtimeDtos(
                [
                    new Date('2013-01-31T12:00'),
                    new Date('2013-01-31T14:00'),
                    new Date('2013-01-31T16:30'),
                    new Date('2013-01-31T18:30')
                ],
                { theaterId: theater.id, durationMinutes: 90 }
            )

            showtimes = await createShowtimes(showtimesService, createDtos)
        })

        it('생성 요청이 기존 상영시간 충돌할 때 충돌 정보를 반환해야 한다', async () => {
            const monitorPromise = monitorEvents(client, ['fail'])

            const { batchId } = await createBatchShowtimes(
                client,
                movie.id,
                [theater.id],
                [
                    new Date('2013-01-31T12:00'),
                    new Date('2013-01-31T16:00'),
                    new Date('2013-01-31T20:00')
                ],
                30
            )

            expect(batchId).toBeDefined()

            const expected = showtimes.filter((showtime) =>
                [
                    new Date('2013-01-31T12:00').getTime(),
                    new Date('2013-01-31T16:30').getTime(),
                    new Date('2013-01-31T18:30').getTime()
                ].includes(showtime.startTime.getTime())
            )
            const { conflictingShowtimes, ...result } = (await monitorPromise) as any
            expect(result).toEqual({ batchId, status: 'fail' })
            expectEqualUnsorted(conflictingShowtimes, expected)
        })
    })
})
