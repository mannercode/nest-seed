import { TheaterDto } from 'apps/cores'
import { expectEqualUnsorted, nullObjectId } from 'testlib'
import { Errors } from '../__helpers__'
import { buildCreateTheaterDto, createTheater } from '../common.fixture'
import { Fixture } from './theaters.fixture'

describe('Theaters', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./theaters.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('POST /theaters', () => {
        // 극장을 생성해야 한다
        it('Should create a theater', async () => {
            const { createDto, expectedDto } = buildCreateTheaterDto()

            await fix.httpClient.post('/theaters').body(createDto).created(expectedDto)
        })

        // 필수 필드가 누락되면 BAD_REQUEST(400)를 반환해야 한다
        it('Should return BAD_REQUEST(400) if required fields are missing', async () => {
            await fix.httpClient
                .post('/theaters')
                .body({})
                .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
        })
    })

    describe('PATCH /theaters/:id', () => {
        let theater: TheaterDto

        beforeEach(async () => {
            theater = await createTheater(fix)
        })

        // 극장 정보를 업데이트해야 한다
        it('Should update theater details', async () => {
            const updateDto = {
                name: 'update-name',
                location: { latitude: 30.0, longitude: 120.0 },
                seatmap: []
            }
            const expected = { ...theater, ...updateDto }

            await fix.httpClient.patch(`/theaters/${theater.id}`).body(updateDto).ok(expected)
            await fix.httpClient.get(`/theaters/${theater.id}`).ok(expected)
        })

        it('dummy test for coverage', async () => {
            await fix.httpClient.patch(`/theaters/${theater.id}`).body({}).ok(theater)
        })

        // 극장이 존재하지 않으면 NOT_FOUND(404)를 반환해야 한다
        it('Should return NOT_FOUND(404) if the theater does not exist', async () => {
            await fix.httpClient
                .patch(`/theaters/${nullObjectId}`)
                .body({})
                .notFound({ ...Errors.Mongoose.DocumentNotFound, notFoundId: nullObjectId })
        })
    })

    describe('DELETE /theaters/:id', () => {
        let theater: TheaterDto

        beforeEach(async () => {
            theater = await createTheater(fix)
        })

        // 극장을 삭제해야 한다
        it('Should delete the theater', async () => {
            await fix.httpClient.delete(`/theaters/${theater.id}`).ok()
            await fix.httpClient.get(`/theaters/${theater.id}`).notFound({
                ...Errors.Mongoose.MultipleDocumentsNotFound,
                notFoundIds: [theater.id]
            })
        })

        // 극장이 존재하지 않으면 NOT_FOUND(404)를 반환해야 한다
        it('Should return NOT_FOUND(404) if the theater does not exist', async () => {
            await fix.httpClient.delete(`/theaters/${nullObjectId}`).notFound({
                ...Errors.Mongoose.MultipleDocumentsNotFound,
                notFoundIds: [nullObjectId]
            })
        })
    })

    describe('GET /theaters/:id', () => {
        let theater: TheaterDto

        beforeEach(async () => {
            theater = await createTheater(fix)
        })

        // 극장 상세 정보를 반환해야 한다
        it('Should return theater details', async () => {
            await fix.httpClient.get(`/theaters/${theater.id}`).ok(theater)
        })

        // 극장이 존재하지 않으면 NOT_FOUND(404)를 반환해야 한다
        it('Should return NOT_FOUND(404) if the theater does not exist', async () => {
            await fix.httpClient.get(`/theaters/${nullObjectId}`).notFound({
                ...Errors.Mongoose.MultipleDocumentsNotFound,
                notFoundIds: [nullObjectId]
            })
        })
    })

    describe('GET /theaters', () => {
        let theaters: TheaterDto[]

        beforeEach(async () => {
            theaters = await Promise.all([
                createTheater(fix, { name: 'Theater-a1' }),
                createTheater(fix, { name: 'Theater-a2' }),
                createTheater(fix, { name: 'Theater-b1' }),
                createTheater(fix, { name: 'Theater-b2' }),
                createTheater(fix, { name: 'Theater-c1' })
            ])
        })

        // 기본 페이지네이션으로 극장 목록을 반환해야 한다
        it('Should return theaters with default pagination', async () => {
            const { body } = await fix.httpClient.get('/theaters').ok()
            const { items, ...paginated } = body

            expect(paginated).toEqual({
                skip: 0,
                take: expect.any(Number),
                total: theaters.length
            })
            expectEqualUnsorted(items, theaters)
        })

        // TODO
        // 잘못된 필드로 검색하면 BAD_REQUEST(400)를 반환해야 한다
        it('Should return BAD_REQUEST(400) if searching with an invalid field', async () => {
            await fix.httpClient
                .get('/theaters')
                .query({ wrong: 'value' })
                .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
        })

        // 이름의 일부로 극장 목록을 반환해야 한다
        it('Should return theaters filtered by partial name', async () => {
            const partialName = 'Theater-a'
            const { body } = await fix.httpClient.get('/theaters').query({ name: partialName }).ok()

            expectEqualUnsorted(body.items, [theaters[0], theaters[1]])
        })
    })
})
