import { convertDateToString, pickIds } from 'common'
import { HttpTestClient } from 'testlib'
import { Seatmap, TicketDto } from 'types'
import { closeFixture, createFixture, Fixture } from './booking.fixture'

describe('Scenario: Booking', () => {
    let fixture: Fixture
    let client: HttpTestClient
    let movieId: string

    beforeEach(async () => {
        fixture = await createFixture()
        client = fixture.testContext.client
        movieId = fixture.movie.id
    })

    afterEach(async () => {
        await closeFixture(fixture)
    })

    it('전체 시나리오를 하나의 테스트로 실행한다', async () => {
        const step = (_name: string, fn: () => void) => fn()

        let theaterId: string
        let seatCount: number
        let showdate: string
        let showtimeId: string
        let tickets: TicketDto[]

        await step('1. 상영 극장 목록 요청', async () => {
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
            seatCount = Seatmap.getSeatCount(theaters[0].seatmap)
        })

        await step('2. 상영일 목록 요청', async () => {
            const { body: showdates } = await client
                .get(`/booking/movies/${movieId}/theaters/${theaterId}/showdates`)
                .ok()

            expect(showdates).toEqual([
                new Date('2999-01-01'),
                new Date('2999-01-02'),
                new Date('2999-01-03')
            ])

            showdate = convertDateToString(showdates[0])
        })

        await step('3. 상영 시간 목록 요청', async () => {
            const { body: showtimes } = await client
                .get(
                    `/booking/movies/${movieId}/theaters/${theaterId}/showdates/${showdate}/showtimes`
                )
                .ok()

            expect(showtimes).toEqual(
                expect.arrayContaining(
                    [
                        {
                            movieId,
                            theaterId,
                            startTime: new Date('2999-01-01T12:00'),
                            salesStatus: { total: seatCount, sold: 0, available: seatCount }
                        },
                        {
                            movieId,
                            theaterId,
                            startTime: new Date('2999-01-01T14:00'),
                            salesStatus: { total: seatCount, sold: 0, available: seatCount }
                        }
                    ].map((item) => expect.objectContaining(item))
                )
            )

            showtimeId = showtimes[0].id
        })

        await step('4. 구매 가능한 티켓 목록 요청', async () => {
            const { body } = await client.get(`/booking/showtimes/${showtimeId}/tickets`).ok()
            tickets = body
            expect(tickets).toHaveLength(seatCount)
        })

        await step('5. 티켓 선점', async () => {
            const ticketIds = pickIds(tickets.slice(0, 4))

            await client
                .patch(`/booking/showtimes/${showtimeId}/tickets`)
                .headers({ Authorization: `Bearer ${fixture.accessToken}` })
                .body({ ticketIds })
                .ok({ heldTicketIds: ticketIds })
        })
    })
})
