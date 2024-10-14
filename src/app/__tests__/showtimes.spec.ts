import { ShowtimesService } from 'services/showtimes'
import {
    closeIsolatedFixture,
    createIsolatedFixture,
    generateShowtimeCreationDtos,
    IsolatedFixture
} from './showtimes.fixture'

describe('ShowtimesModule', () => {
    let isolated: IsolatedFixture
    let service: ShowtimesService

    beforeEach(async () => {
        isolated = await createIsolatedFixture()
        service = isolated.service
    })

    afterEach(async () => {
        await closeIsolatedFixture(isolated)
    })

    describe('createShowtimes', () => {
        it('상영시간을 생성해야 한다', async () => {
            const { creationDtos, expectedDtos } = generateShowtimeCreationDtos()

            await service.createShowtimes(creationDtos)
            await client.post('/showtimes').body(creationDto).created(expectedDto)
        })

        it('필수 필드가 누락되면 BAD_REQUEST(400)를 반환해야 한다', async () => {
            await client
                .post('/showtimes')
                .body({})
                .badRequest([
                    'name should not be empty',
                    'name must be a string',
                    'seatmap should not be empty'
                ])
        })
    })

    // describe('PATCH /showtimes/:id', () => {
    //     let showtime: ShowtimeDto

    //     beforeEach(async () => {
    //         showtime = await createShowtime(client)
    //     })

    //     it('상영시간 정보를 업데이트해야 한다', async () => {
    //         const updateDto = {
    //             name: `Update-Name`,
    //             latlong: { latitude: 30.0, longitude: 120.0 },
    //             seatmap: []
    //         }
    //         const expected = { ...showtime, ...updateDto }

    //         await client.patch(`/showtimes/${showtime.id}`).body(updateDto).ok(expected)
    //         await client.get(`/showtimes/${showtime.id}`).ok(expected)
    //     })

    //     it('상영시간이 존재하지 않으면 NOT_FOUND(404)를 반환해야 한다', async () => {
    //         await client
    //             .patch(`/showtimes/${nullObjectId}`)
    //             .body({})
    //             .notFound('Showtime with ID 000000000000000000000000 not found')
    //     })
    // })

    // describe('DELETE /showtimes/:id', () => {
    //     let showtime: ShowtimeDto

    //     beforeEach(async () => {
    //         showtime = await createShowtime(client)
    //     })

    //     it('상영시간을 삭제해야 한다', async () => {
    //         await client.delete(`/showtimes/${showtime.id}`).ok()
    //         await client
    //             .get(`/showtimes/${showtime.id}`)
    //             .notFound(`Showtime with ID ${showtime.id} not found`)
    //     })

    //     it('상영시간이 존재하지 않으면 NOT_FOUND(404)를 반환해야 한다', async () => {
    //         await client
    //             .delete(`/showtimes/${nullObjectId}`)
    //             .notFound('Showtime with ID 000000000000000000000000 not found')
    //     })
    // })

    // describe('GET /showtimes/:id', () => {
    //     let showtime: ShowtimeDto

    //     beforeEach(async () => {
    //         showtime = await createShowtime(client)
    //     })

    //     it('상영시간 정보를 가져와야 한다', async () => {
    //         await client.get(`/showtimes/${showtime.id}`).ok(showtime)
    //     })

    //     it('상영시간이 존재하지 않으면 NOT_FOUND(404)를 반환해야 한다', async () => {
    //         await client
    //             .get(`/showtimes/${nullObjectId}`)
    //             .notFound('Showtime with ID 000000000000000000000000 not found')
    //     })
    // })

    // describe('GET /showtimes', () => {
    //     let showtimes: ShowtimeDto[]

    //     beforeEach(async () => {
    //         showtimes = await createShowtimes(client)
    //     })

    //     it('기본 페이지네이션 설정으로 상영시간을 가져와야 한다', async () => {
    //         const { body } = await client.get('/showtimes').ok()
    //         const { items, ...paginated } = body

    //         expect(paginated).toEqual({
    //             skip: 0,
    //             take: expect.any(Number),
    //             total: showtimes.length
    //         })
    //         expectEqualUnsorted(items, showtimes)
    //     })

    //     it('잘못된 필드로 검색하면 BAD_REQUEST(400)를 반환해야 한다', async () => {
    //         await client
    //             .get('/showtimes')
    //             .query({ wrong: 'value' })
    //             .badRequest(['property wrong should not exist'])
    //     })

    //     it('이름의 일부로 상영시간을 검색할 수 있어야 한다', async () => {
    //         const partialName = 'Showtime-'
    //         const { body } = await client.get('/showtimes').query({ name: partialName }).ok()

    //         const expected = showtimes.filter((showtime) => showtime.name.startsWith(partialName))
    //         expectEqualUnsorted(body.items, expected)
    //     })
    // })
})
