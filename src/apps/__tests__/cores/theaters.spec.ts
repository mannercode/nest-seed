import { SearchTheatersPageDto, TheaterDto } from 'apps/cores'
import { nullObjectId } from 'testlib'
import { buildCreateTheaterDto, createTheater, Errors } from '../__helpers__'
import type { TheatersFixture } from './theaters.fixture'

describe('TheatersService', () => {
    let fixture: TheatersFixture

    beforeEach(async () => {
        const { createTheatersFixture } = await import('./theaters.fixture')
        fixture = await createTheatersFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('POST /theaters', () => {
        describe('when the payload is valid', () => {
            const payload = buildCreateTheaterDto()

            it('returns 201 with the created theater', async () => {
                await fixture.httpClient
                    .post('/theaters')
                    .body(payload)
                    .created({ ...payload, id: expect.any(String) })
            })
        })

        describe('when the required fields are missing', () => {
            const invalidPayload = {}

            it('returns 400 Bad Request', async () => {
                await fixture.httpClient
                    .post('/theaters')
                    .body(invalidPayload)
                    .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
            })
        })
    })

    describe('GET /theaters/:id', () => {
        describe('when the theater exists', () => {
            let theater: TheaterDto

            beforeEach(async () => {
                theater = await createTheater(fixture)
            })

            it('returns 200 with the theater', async () => {
                await fixture.httpClient.get(`/theaters/${theater.id}`).ok(theater)
            })
        })

        describe('when the theater does not exist', () => {
            it('returns 404 Not Found', async () => {
                await fixture.httpClient
                    .get(`/theaters/${nullObjectId}`)
                    .notFound({
                        ...Errors.Mongoose.MultipleDocumentsNotFound,
                        notFoundIds: [nullObjectId]
                    })
            })
        })
    })

    describe('PATCH /theaters/:id', () => {
        describe('when the payload is valid', () => {
            let theater: TheaterDto
            let payload: any

            beforeEach(async () => {
                theater = await createTheater(fixture, { name: 'original-name' })
                payload = {
                    name: 'update-name',
                    location: { latitude: 30.0, longitude: 120.0 },
                    seatmap: { blocks: [] }
                }
            })

            it('returns 200 with the updated theater', async () => {
                const expected = { ...theater, ...payload }

                await fixture.httpClient.patch(`/theaters/${theater.id}`).body(payload).ok(expected)
                await fixture.httpClient.get(`/theaters/${theater.id}`).ok(expected)
            })
        })

        describe('when the theater does not exist', () => {
            it('returns 404 Not Found', async () => {
                await fixture.httpClient
                    .patch(`/theaters/${nullObjectId}`)
                    .body({})
                    .notFound({ ...Errors.Mongoose.DocumentNotFound, notFoundId: nullObjectId })
            })
        })
    })

    describe('DELETE /theaters/:id', () => {
        describe('when the theater exists', () => {
            let theater: TheaterDto

            beforeEach(async () => {
                theater = await createTheater(fixture)
            })

            it('returns 200 with the deleted theater', async () => {
                await fixture.httpClient
                    .delete(`/theaters/${theater.id}`)
                    .ok({ deletedTheaters: [theater] })

                await fixture.httpClient
                    .get(`/theaters/${theater.id}`)
                    .notFound({
                        ...Errors.Mongoose.MultipleDocumentsNotFound,
                        notFoundIds: [theater.id]
                    })
            })
        })

        describe('when the theater does not exist', () => {
            it('returns 404 Not Found', async () => {
                await fixture.httpClient
                    .delete(`/theaters/${nullObjectId}`)
                    .notFound({
                        ...Errors.Mongoose.MultipleDocumentsNotFound,
                        notFoundIds: [nullObjectId]
                    })
            })
        })
    })

    describe('GET /theaters', () => {
        let theaterA1: TheaterDto
        let theaterA2: TheaterDto
        let theaterB1: TheaterDto
        let theaterB2: TheaterDto

        beforeEach(async () => {
            ;[theaterA1, theaterA2, theaterB1, theaterB2] = await Promise.all([
                createTheater(fixture, { name: 'theater-a1' }),
                createTheater(fixture, { name: 'theater-a2' }),
                createTheater(fixture, { name: 'theater-b1' }),
                createTheater(fixture, { name: 'theater-b2' })
            ])
        })

        const buildExpectedPage = (theaters: TheaterDto[]) => ({
            skip: 0,
            take: expect.any(Number),
            total: theaters.length,
            items: expect.arrayContaining(theaters)
        })

        describe('when no query parameters are provided', () => {
            it('returns 200 with the default page of theaters', async () => {
                const expected = buildExpectedPage([theaterA1, theaterA2, theaterB1, theaterB2])

                await fixture.httpClient.get('/theaters').ok(expected)
            })
        })

        describe('when query parameters are provided', () => {
            const queryAndExpect = (query: SearchTheatersPageDto, theaters: TheaterDto[]) =>
                fixture.httpClient.get('/theaters').query(query).ok(buildExpectedPage(theaters))

            it('returns theaters filtered by a partial name match', async () => {
                await queryAndExpect({ name: 'theater-a' }, [theaterA1, theaterA2])
            })
        })

        describe('when the query parameters are invalid', () => {
            it('returns 400 Bad Request', async () => {
                await fixture.httpClient
                    .get('/theaters')
                    .query({ wrong: 'value' })
                    .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
            })
        })
    })
})
