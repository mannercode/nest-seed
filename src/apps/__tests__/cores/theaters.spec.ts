import { TheaterDto } from 'apps/cores'
import { nullObjectId } from 'testlib'
import { buildCreateTheaterDto, createTheater, Errors } from '../__helpers__'
import type { Fixture } from './theaters.fixture'

describe('TheatersService', () => {
    let fixture: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./theaters.fixture')
        fixture = await createFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('POST /theaters', () => {
        describe('when the payload is valid', () => {
            it('creates and returns a theater', async () => {
                const createDto = buildCreateTheaterDto()

                await fixture.httpClient
                    .post('/theaters')
                    .body(createDto)
                    .created({ id: expect.any(String), ...createDto })
            })
        })

        describe('when the required fields are missing', () => {
            it('returns 400 Bad Request', async () => {
                await fixture.httpClient
                    .post('/theaters')
                    .body({})
                    .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
            })
        })
    })

    describe('GET /theaters/:id', () => {
        describe('when the theater exists', () => {
            it('returns the theater', async () => {
                await fixture.httpClient
                    .get(`/theaters/${fixture.createdTheater.id}`)
                    .ok(fixture.createdTheater)
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
            it('updates and returns the theater', async () => {
                const updateDto = {
                    name: 'update-name',
                    location: { latitude: 30.0, longitude: 120.0 },
                    seatmap: []
                }
                const expected = { ...fixture.createdTheater, ...updateDto }

                await fixture.httpClient
                    .patch(`/theaters/${fixture.createdTheater.id}`)
                    .body(updateDto)
                    .ok(expected)

                await fixture.httpClient.get(`/theaters/${fixture.createdTheater.id}`).ok(expected)
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
            it('deletes the theater', async () => {
                await fixture.httpClient.delete(`/theaters/${fixture.createdTheater.id}`).ok()

                await fixture.httpClient
                    .get(`/theaters/${fixture.createdTheater.id}`)
                    .notFound({
                        ...Errors.Mongoose.MultipleDocumentsNotFound,
                        notFoundIds: [fixture.createdTheater.id]
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
        let theaters: TheaterDto[]

        beforeEach(async () => {
            const createdTheaters = await Promise.all([
                createTheater(fixture, { name: 'Theater-a1' }),
                createTheater(fixture, { name: 'Theater-a2' }),
                createTheater(fixture, { name: 'Theater-b1' }),
                createTheater(fixture, { name: 'Theater-b2' }),
                createTheater(fixture, { name: 'Theater-c1' })
            ])

            theaters = [...createdTheaters, fixture.createdTheater]
        })

        describe('when the query parameters are missing', () => {
            it('returns theaters with default pagination', async () => {
                await fixture.httpClient
                    .get('/theaters')
                    .ok({
                        skip: 0,
                        take: expect.any(Number),
                        total: theaters.length,
                        items: expect.arrayContaining(theaters)
                    })
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

        describe('when a partial `name` is provided', () => {
            it('returns theaters whose name includes the substring', async () => {
                await fixture.httpClient
                    .get('/theaters')
                    .query({ name: 'Theater-a' })
                    .ok(
                        expect.objectContaining({
                            items: expect.arrayContaining([theaters[0], theaters[1]])
                        })
                    )
            })
        })
    })
})
