import { getSeatCount } from 'services/theaters'
import { TicketDto } from 'services/tickets'
import { HttpTestClient } from 'testlib'
import { closeFixture, createFixture, Fixture } from './booking.fixture'
import { pickIds } from 'common'

describe('Booking 시나리오 테스트', () => {
    let fixture: Fixture
    let client: HttpTestClient
    let movieId: string
    let theaterId: string
    let seatCount: number
    let showdate: string
    let showtimeId: string
    let tickets: TicketDto[]

    beforeAll(async () => {
        fixture = await createFixture()
        client = fixture.testContext.client
        movieId = fixture.movie.id
    })

    afterAll(async () => {
        await closeFixture(fixture)
    })

    describe('상영 극장 목록 요청', () => {
        it('상영 극장 목록을 반환해야 한다', async () => {
            const latlong = '31.9,131.9'
            const { body: theaters } = await client
                .get(`/booking/movies/${movieId}/theaters?latlong=${latlong}`)
                .ok()

            expect(theaters).toEqual(
                [
                    { latlong: { latitude: 32.0, longitude: 132.0 } }, // distance = 0.1
                    { latlong: { latitude: 31.0, longitude: 131.0 } }, // distance = 0.9
                    { latlong: { latitude: 33.0, longitude: 133.0 } }, // distance = 1.1
                    { latlong: { latitude: 30.0, longitude: 130.0 } }, // distance = 1.9
                    { latlong: { latitude: 34.0, longitude: 134.0 } } // distance = 2.1
                ].map((item) => expect.objectContaining(item))
            )
            theaterId = theaters[0].id
            seatCount = getSeatCount(theaters[0].seatmap)
        })
    })

    describe('상영일 목록 요청', () => {
        it('상영일 목록을 반환해야 한다', async () => {
            const { body: showdates } = await client
                .get(`/booking/movies/${movieId}/theaters/${theaterId}/showdates`)
                .ok()

            expect(showdates).toEqual(['29990101', '29990102', '29990103', '29990104'])
            showdate = showdates[0]
        })
    })

    describe('상영 시간 목록 요청', () => {
        it('상영 시간 목록을 반환해야 한다', async () => {
            const { body: showtimes } = await client
                .get(
                    `/booking/movies/${movieId}/theaters/${theaterId}/showdates/${showdate}/showtimes`
                )
                .ok()

            expect(showtimes).toEqual(
                expect.arrayContaining(
                    [
                        { movieId, theaterId, startTime: new Date('2999-01-01T12:00') },
                        { movieId, theaterId, startTime: new Date('2999-01-01T14:00') }
                    ].map((item) => expect.objectContaining(item))
                )
            )

            showtimeId = showtimes[0].id
        })
    })

    describe('구매 가능한 티켓 목록 요청', () => {
        it('구매 가능한 티켓 목록을 반환해야 한다', async () => {
            const { body } = await client.get(`/booking/showtimes/${showtimeId}/tickets`).ok()
            tickets = body
            expect(tickets).toHaveLength(seatCount)
        })
    })

    describe('티켓 선점', () => {
        it('티켓을 선점해야 한다', async () => {
            const ticketIds = pickIds(tickets.slice(0, 4))

            await client
                .patch(`/booking/showtimes/${showtimeId}/tickets`)
                .headers({ Authorization: `Bearer ${fixture.accessToken}` })
                .body({ ticketIds })
                .ok({ heldTicketIds: ticketIds })
        })
    })
})
