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
        // payload가 유효한 경우
        describe('when payload is valid', () => {
            // 극장을 생성하고 반환한다
            it('creates and returns a theater', async () => {
                const createDto = buildCreateTheaterDto()

                await fixture.httpClient
                    .post('/theaters')
                    .body(createDto)
                    .created({ id: expect.any(String), ...createDto })
            })
        })

        // 필수 필드가 누락된 경우
        describe('when required fields are missing', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                await fixture.httpClient
                    .post('/theaters')
                    .body({})
                    .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
            })
        })
    })

    describe('GET /theaters/:id', () => {
        // 극장이 존재하는 경우
        describe('when theater exists', () => {
            // 극장 정보를 반환한다
            it('returns the theater', async () => {
                await fixture.httpClient
                    .get(`/theaters/${fixture.createdTheater.id}`)
                    .ok(fixture.createdTheater)
            })
        })

        // 극장이 존재하지 않는 경우
        describe('when theater does not exist', () => {
            // 404 Not Found를 반환한다
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
        // payload가 유효한 경우
        describe('when payload is valid', () => {
            // 극장 정보를 수정하고 반환한다
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

        // 극장이 존재하지 않는 경우
        describe('when theater does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fixture.httpClient
                    .patch(`/theaters/${nullObjectId}`)
                    .body({})
                    .notFound({ ...Errors.Mongoose.DocumentNotFound, notFoundId: nullObjectId })
            })
        })
    })

    describe('DELETE /theaters/:id', () => {
        // 극장이 존재하는 경우
        describe('when theater exists', () => {
            // 극장을 삭제한다.
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

        // 극장이 존재하지 않는 경우
        describe('when theater does not exist', () => {
            // 404 Not Found를 반환한다
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

        // 쿼리 파라미터가 없는 경우
        describe('when query parameters are missing', () => {
            // 기본 페이지네이션으로 극장을 반환한다
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

        // 쿼리 파라미터가 유효하지 않은 경우
        describe('when query parameters are invalid', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                await fixture.httpClient
                    .get('/theaters')
                    .query({ wrong: 'value' })
                    .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
            })
        })

        // `name` 부분 문자열이 제공된 경우
        describe('when partial `name` is provided', () => {
            // 이름에 해당 부분 문자열이 포함된 극장을 반환한다
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
