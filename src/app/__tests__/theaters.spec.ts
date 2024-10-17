import { expect } from '@jest/globals'
import { nullObjectId, pickIds } from 'common'
import { TheaterDto } from 'services/theaters'
import { expectEqualUnsorted, HttpTestClient } from 'testlib'
import {
    closeIsolatedFixture,
    createIsolatedFixture,
    createTheater,
    createTheaters,
    IsolatedFixture,
    createTheaterDto
} from './theaters.fixture'

describe('/theaters', () => {
    let isolated: IsolatedFixture
    let client: HttpTestClient

    beforeEach(async () => {
        isolated = await createIsolatedFixture()
        client = isolated.testContext.client
    })

    afterEach(async () => {
        await closeIsolatedFixture(isolated)
    })

    describe('POST /theaters', () => {
        it('극장을 생성해야 한다', async () => {
            const { creationDto, expectedDto } = createTheaterDto()

            await client.post('/theaters').body(creationDto).created(expectedDto)
        })

        it('필수 필드가 누락되면 BAD_REQUEST(400)를 반환해야 한다', async () => {
            await client
                .post('/theaters')
                .body({})
                .badRequest([
                    'name should not be empty',
                    'name must be a string',
                    'latlong should not be empty',
                    'seatmap should not be empty'
                ])
        })
    })

    describe('PATCH /theaters/:id', () => {
        let theater: TheaterDto

        beforeEach(async () => {
            theater = await createTheater(client)
        })

        it('극장 정보를 업데이트해야 한다', async () => {
            const updateDto = {
                name: `Update-Name`,
                latlong: { latitude: 30.0, longitude: 120.0 },
                seatmap: []
            }
            const expected = { ...theater, ...updateDto }

            await client.patch(`/theaters/${theater.id}`).body(updateDto).ok(expected)
            await client.get(`/theaters/${theater.id}`).ok(expected)
        })

        it('극장이 존재하지 않으면 NOT_FOUND(404)를 반환해야 한다', async () => {
            await client
                .patch(`/theaters/${nullObjectId}`)
                .body({})
                .notFound('Theater with ID 000000000000000000000000 not found')
        })
    })

    describe('DELETE /theaters/:id', () => {
        let theater: TheaterDto

        beforeEach(async () => {
            theater = await createTheater(client)
        })

        it('극장을 삭제해야 한다', async () => {
            await client.delete(`/theaters/${theater.id}`).ok()
            await client
                .get(`/theaters/${theater.id}`)
                .notFound(`Theater with ID ${theater.id} not found`)
        })

        it('극장이 존재하지 않으면 NOT_FOUND(404)를 반환해야 한다', async () => {
            await client
                .delete(`/theaters/${nullObjectId}`)
                .notFound('Theater with ID 000000000000000000000000 not found')
        })
    })

    describe('GET /theaters/:id', () => {
        let theater: TheaterDto

        beforeEach(async () => {
            theater = await createTheater(client)
        })

        it('극장 정보를 가져와야 한다', async () => {
            await client.get(`/theaters/${theater.id}`).ok(theater)
        })

        it('극장이 존재하지 않으면 NOT_FOUND(404)를 반환해야 한다', async () => {
            await client
                .get(`/theaters/${nullObjectId}`)
                .notFound('Theater with ID 000000000000000000000000 not found')
        })
    })

    describe('GET /theaters', () => {
        let theaters: TheaterDto[]

        beforeEach(async () => {
            theaters = await createTheaters(client)
        })

        it('기본 페이지네이션 설정으로 극장을 가져와야 한다', async () => {
            const { body } = await client.get('/theaters').ok()
            const { items, ...paginated } = body

            expect(paginated).toEqual({
                skip: 0,
                take: expect.any(Number),
                total: theaters.length
            })
            expectEqualUnsorted(items, theaters)
        })

        it('잘못된 필드로 검색하면 BAD_REQUEST(400)를 반환해야 한다', async () => {
            await client
                .get('/theaters')
                .query({ wrong: 'value' })
                .badRequest(['property wrong should not exist'])
        })

        it('이름의 일부로 극장을 검색할 수 있어야 한다', async () => {
            const partialName = 'Theater-'
            const { body } = await client.get('/theaters').query({ name: partialName }).ok()

            const expected = theaters.filter((theater) => theater.name.startsWith(partialName))
            expectEqualUnsorted(body.items, expected)
        })
    })

    describe('POST /theaters/getByIds', () => {
        let theaters: TheaterDto[]

        beforeEach(async () => {
            theaters = await createTheaters(client)
        })

        it('theaterIds로 극장을 검색할 수 있어야 한다', async () => {
            const expectedTheaters = theaters.slice(0, 5)
            const queryDto = { theaterIds: pickIds(expectedTheaters) }

            const { body } = await client.post('/theaters/getByIds').body(queryDto).ok()

            expectEqualUnsorted(body, expectedTheaters)
        })

        it('극장이 존재하지 않으면 NOT_FOUND(404)를 반환해야 한다', async () => {
            const queryDto = { theaterIds: [nullObjectId] }

            return client.post('/theaters/getByIds').body(queryDto).notFound()
        })
    })
})
