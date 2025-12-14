import { SearchTheatersPageDto, TheaterDto } from 'apps/cores'
import { nullObjectId } from 'testlib'
import { buildCreateTheaterDto, createTheater, Errors } from '../__helpers__'
import type { TheatersFixture } from './theaters.fixture'

describe('TheatersService', () => {
    let fix: TheatersFixture

    beforeEach(async () => {
        const { createTheatersFixture } = await import('./theaters.fixture')
        fix = await createTheatersFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('POST /theaters', () => {
        it('returns the created theater', async () => {
            const payload = buildCreateTheaterDto()

            await fix.httpClient
                .post('/theaters')
                .body(payload)
                .created({ ...payload, id: expect.any(String) })
        })

        it('returns 400 Bad Request for missing required fields', async () => {
            await fix.httpClient
                .post('/theaters')
                .body({})
                .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
        })
    })

    describe('GET /theaters/:id', () => {
        describe('when the theater exists', () => {
            let theater: TheaterDto

            beforeEach(async () => {
                theater = await createTheater(fix)
            })

            it('returns the theater', async () => {
                await fix.httpClient.get(`/theaters/${theater.id}`).ok(theater)
            })
        })

        it('returns 404 Not Found for a non-existent theater', async () => {
            await fix.httpClient
                .get(`/theaters/${nullObjectId}`)
                .notFound({
                    ...Errors.Mongoose.MultipleDocumentsNotFound,
                    notFoundIds: [nullObjectId]
                })
        })
    })

    describe('PATCH /theaters/:id', () => {
        describe('when the theater exists', () => {
            let theater: TheaterDto

            beforeEach(async () => {
                theater = await createTheater(fix, { name: 'original-name' })
            })

            it('returns the updated theater', async () => {
                const payload = {
                    name: 'update-name',
                    location: { latitude: 30.0, longitude: 120.0 },
                    seatmap: { blocks: [] }
                }

                await fix.httpClient
                    .patch(`/theaters/${theater.id}`)
                    .body(payload)
                    .ok({ ...theater, ...payload })
            })

            it('persists the update', async () => {
                const payload = { name: 'update-name' }
                await fix.httpClient.patch(`/theaters/${theater.id}`).body(payload).ok()

                await fix.httpClient.get(`/theaters/${theater.id}`).ok({ ...theater, ...payload })
            })
        })

        it('returns 404 Not Found for a non-existent theater', async () => {
            await fix.httpClient
                .patch(`/theaters/${nullObjectId}`)
                .body({})
                .notFound({ ...Errors.Mongoose.DocumentNotFound, notFoundId: nullObjectId })
        })
    })

    describe('DELETE /theaters/:id', () => {
        describe('when the theater exists', () => {
            let theater: TheaterDto

            beforeEach(async () => {
                theater = await createTheater(fix)
            })

            it('returns the deleted theater', async () => {
                await fix.httpClient
                    .delete(`/theaters/${theater.id}`)
                    .ok({ deletedTheaters: [theater] })
            })

            it('persists the deletion', async () => {
                await fix.httpClient.delete(`/theaters/${theater.id}`).ok()

                await fix.httpClient
                    .get(`/theaters/${theater.id}`)
                    .notFound({
                        ...Errors.Mongoose.MultipleDocumentsNotFound,
                        notFoundIds: [theater.id]
                    })
            })
        })

        it('returns 404 Not Found for a non-existent theater', async () => {
            await fix.httpClient
                .delete(`/theaters/${nullObjectId}`)
                .notFound({
                    ...Errors.Mongoose.MultipleDocumentsNotFound,
                    notFoundIds: [nullObjectId]
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
                createTheater(fix, { name: 'theater-a1' }),
                createTheater(fix, { name: 'theater-a2' }),
                createTheater(fix, { name: 'theater-b1' }),
                createTheater(fix, { name: 'theater-b2' })
            ])
        })

        const buildExpectedPage = (theaters: TheaterDto[]) => ({
            skip: 0,
            take: expect.any(Number),
            total: theaters.length,
            items: expect.arrayContaining(theaters)
        })

        it('returns the default page when no query is provided', async () => {
            const expected = buildExpectedPage([theaterA1, theaterA2, theaterB1, theaterB2])

            await fix.httpClient.get('/theaters').ok(expected)
        })

        describe('when query parameters are provided', () => {
            const queryAndExpect = (query: SearchTheatersPageDto, theaters: TheaterDto[]) =>
                fix.httpClient.get('/theaters').query(query).ok(buildExpectedPage(theaters))

            it('returns theaters filtered by a partial name match', async () => {
                await queryAndExpect({ name: 'theater-a' }, [theaterA1, theaterA2])
            })
        })

        it('returns 400 Bad Request for invalid query parameters', async () => {
            await fix.httpClient
                .get('/theaters')
                .query({ wrong: 'value' })
                .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
        })
    })
})
