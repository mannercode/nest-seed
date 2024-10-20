import { MovieDto } from 'services/movies'
import { ShowtimeDto, ShowtimesService } from 'services/showtimes'
import { getSeatCount, TheaterDto } from 'services/theaters'
import { expectEqualUnsorted, HttpTestClient, parseEventMessage } from 'testlib'
import {
    closeIsolatedFixture,
    createIsolatedFixture,
    IsolatedFixture
} from './showtime-creation.fixture'

describe('ShowtimeCreation', () => {
    let isolated: IsolatedFixture
    let client: HttpTestClient
    let service: ShowtimesService
    let movie: MovieDto
    let theater: TheaterDto
    let showtimes: ShowtimeDto[]

    beforeEach(async () => {
        isolated = await createIsolatedFixture()
        client = isolated.testContext.client
        service = isolated.service
        movie = isolated.movie
        theater = isolated.theater
        showtimes = isolated.showtimes
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

    it('상영시간 목록 요청', async () => {
        const { body } = await client
            .post('/showtime-creation/showtimes/find')
            .body({ theaterIds: [theater.id] })
            .ok()

        expectEqualUnsorted(body, showtimes)
    })

    describe('상영시간 등록 요청', () => {
        it('상영시간 등록 요청이 성공해야 한다', async () => {
            const theaterIds = [theater.id]
            const startTimes = [299912310900, 299912311100, 299912131300]
            const seatCount = getSeatCount(theater.seatmap)

            const showtimeBatchCreationRequest = {
                movieId: movie.id,
                theaterIds,
                startTimes,
                durationMinutes: 90
            }

            const { body } = await client
                .post('/showtime-creation/showtimes')
                .body(showtimeBatchCreationRequest)
                .accepted()

            expect(body.batchId).toBeDefined()

            const promise = new Promise<{ status: string }>((resolve, reject) => {
                client.get('/showtime-creation/events').sse(async (data: any) => {
                    console.log(data)
                    resolve(data)
                }, reject)
            })

            await expect(promise).resolves.toEqual({
                batchId: body.batchId,
                status: 'complete',
                showtimeCreatedCount: theaterIds.length * startTimes.length,
                ticketCreatedCount: theaterIds.length * startTimes.length * seatCount
            })
        })
    })
})
