import { Seatmap, ShowtimeDto, TheaterDto, TicketDto } from 'apps/cores'
import { DateUtil, pickIds } from 'common'
import { nullObjectId, step } from 'testlib'
import { Errors } from '../__helpers__'
import { Fixture } from './booking.fixture'

describe('BookingService', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./booking.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    // 상황: 성공적인 영화 예매 흐름
    describe('a successful movie booking flow', () => {
        // 기대 결과: 예매의 모든 단계를 처음부터 끝까지 성공적으로 완료한다.
        it('completes the entire booking process from start to finish', async () => {
            let theater: TheaterDto
            let showdate: Date
            let showtime: ShowtimeDto
            let tickets: TicketDto[]

            // 1. 영화를 상영하는 극장 목록을 조회한다.
            await step('1. requests a list of theaters screening the movie', async () => {
                const latLong = '31.9,131.9'
                const { body: theaters } = await fix.httpClient
                    .get(`/booking/movies/${fix.movie.id}/theaters?latLong=${latLong}`)
                    .ok()

                expect(theaters).toEqual(
                    [
                        { location: { latitude: 32.0, longitude: 132.0 } }, // distance = 0.1
                        { location: { latitude: 31.0, longitude: 131.0 } }, // distance = 0.9
                        { location: { latitude: 33.0, longitude: 133.0 } }, // distance = 1.1
                        { location: { latitude: 30.0, longitude: 130.0 } }, // distance = 1.9
                        { location: { latitude: 34.0, longitude: 134.0 } } // distance = 2.1
                    ].map((item) => expect.objectContaining(item))
                )
                theater = theaters[0]
            })

            // 2. 선택한 극장의 상영일 목록을 조회한다.
            await step('2. requests a list of show dates for the selected theater', async () => {
                const { body: showdates } = await fix.httpClient
                    .get(`/booking/movies/${fix.movie.id}/theaters/${theater.id}/showdates`)
                    .ok()

                expect(showdates).toEqual([
                    new Date('2999-01-01'),
                    new Date('2999-01-02'),
                    new Date('2999-01-03')
                ])
                showdate = showdates[0]
            })

            // 3. 선택한 날짜의 상영 시간 목록을 조회한다.
            await step('3. requests a list of showtimes for the selected date', async () => {
                const movieId = fix.movie.id
                const theaterId = theater.id
                const yymmdd = DateUtil.toYMD(showdate)
                const url = `/booking/movies/${movieId}/theaters/${theaterId}/showdates/${yymmdd}/showtimes`

                const { body: showtimes } = await fix.httpClient.get(url).ok(
                    expect.arrayContaining(
                        [
                            {
                                movieId,
                                theaterId,
                                startTime: new Date('2999-01-01T12:00'),
                                endTime: new Date('2999-01-01T12:01')
                            },
                            {
                                movieId,
                                theaterId,
                                startTime: new Date('2999-01-01T14:00'),
                                endTime: new Date('2999-01-01T14:01')
                            }
                        ].map((item) => expect.objectContaining(item))
                    )
                )
                showtime = showtimes[0]
            })

            // 4. 선택한 상영 시간의 구매 가능한 티켓 목록을 조회한다.
            await step(
                '4. requests a list of available tickets for the selected showtime',
                async () => {
                    const { body } = await fix.httpClient
                        .get(`/booking/showtimes/${showtime.id}/tickets`)
                        .ok()

                    tickets = body
                    const seatCount = Seatmap.getSeatCount(theater.seatmap)
                    expect(tickets).toHaveLength(seatCount)
                }
            )

            // 5. 원하는 티켓을 선점한다.
            await step('5. holds the desired tickets', async () => {
                const ticketIds = pickIds(tickets.slice(0, 4))

                await fix.httpClient
                    .patch(`/booking/showtimes/${showtime.id}/tickets`)
                    .headers({ Authorization: `Bearer ${fix.accessToken}` })
                    .body({ ticketIds })
                    .ok({ success: true })
            })
        })
    })

    describe('GET /booking/showtimes/:id/tickets', () => {
        // 상황: 상영시간이 존재하지 않을 때
        describe('when the showtime does not exist', () => {
            // 기대 결과: 404 Not Found 에러를 반환한다.
            it('returns a 404 Not Found error', async () => {
                await fix.httpClient
                    .get(`/booking/showtimes/${nullObjectId}/tickets`)
                    .notFound({ ...Errors.Booking.ShowtimeNotFound, showtimeId: nullObjectId })
            })
        })
    })
})
