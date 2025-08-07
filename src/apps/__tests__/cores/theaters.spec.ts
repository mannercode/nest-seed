import { TheaterDto } from 'apps/cores'
import { nullObjectId } from 'testlib'
import { buildCreateTheaterDto, createTheater, Errors } from '../__helpers__'
import type { Fixture } from './theaters.fixture'

describe('TheatersService', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./theaters.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('POST /theaters', () => {
        // payload가 유효한 경우
        describe('when the payload is valid', () => {
            // 극장을 생성하고 반환한다
            it('creates and returns a theater', async () => {
                const createDto = buildCreateTheaterDto()

                await fix.httpClient
                    .post('/theaters')
                    .body(createDto)
                    .created({ id: expect.any(String), ...createDto })
            })
        })

        // 필수 필드가 누락되었을 때
        describe('when required fields are missing', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                await fix.httpClient
                    .post('/theaters')
                    .body({})
                    .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
            })
        })
    })

    describe('GET /theaters/:id', () => {
        // 극장이 존재하는 경우
        describe('when the theater exists', () => {
            // 극장 정보를 반환한다
            it('returns the theater', async () => {
                await fix.httpClient
                    .get(`/theaters/${fix.createdTheater.id}`)
                    .ok(fix.createdTheater)
            })
        })

        // 극장이 존재하지 않는 경우
        describe('when the theater does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient
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
        describe('when the payload is valid', () => {
            // 극장 정보를 수정하고 반환한다
            it('updates and returns the theater', async () => {
                const updateDto = {
                    name: 'update-name',
                    location: { latitude: 30.0, longitude: 120.0 },
                    seatmap: []
                }
                const expected = { ...fix.createdTheater, ...updateDto }

                await fix.httpClient
                    .patch(`/theaters/${fix.createdTheater.id}`)
                    .body(updateDto)
                    .ok(expected)

                await fix.httpClient.get(`/theaters/${fix.createdTheater.id}`).ok(expected)
            })
        })

        // payload가 비어있는 경우
        describe('when the payload is empty', () => {
            // 원래 극장 정보를 반환한다
            it('returns the original theater', async () => {
                await fix.httpClient
                    .patch(`/theaters/${fix.createdTheater.id}`)
                    .body({})
                    .ok(fix.createdTheater)
            })
        })

        // 극장이 존재하지 않는 경우
        describe('when the theater does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .patch(`/theaters/${nullObjectId}`)
                    .body({})
                    .notFound({ ...Errors.Mongoose.DocumentNotFound, notFoundId: nullObjectId })
            })
        })
    })

    describe('DELETE /theaters/:id', () => {
        // 극장이 존재하는 경우
        describe('when the theater exists', () => {
            // 극장을 삭제한다.
            it('deletes the theater', async () => {
                await fix.httpClient.delete(`/theaters/${fix.createdTheater.id}`).ok()

                await fix.httpClient
                    .get(`/theaters/${fix.createdTheater.id}`)
                    .notFound({
                        ...Errors.Mongoose.MultipleDocumentsNotFound,
                        notFoundIds: [fix.createdTheater.id]
                    })
            })
        })

        // 극장이 존재하지 않는 경우
        describe('when the theater does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient
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
                createTheater(fix, { name: 'Theater-a1' }),
                createTheater(fix, { name: 'Theater-a2' }),
                createTheater(fix, { name: 'Theater-b1' }),
                createTheater(fix, { name: 'Theater-b2' }),
                createTheater(fix, { name: 'Theater-c1' })
            ])

            theaters = [...createdTheaters, fix.createdTheater]
        })

        // 쿼리 파라미터가 없는 경우
        describe('when query parameters are missing', () => {
            // 기본 페이지네이션으로 극장 목록을 반환한다
            it('returns the theater list with default pagination', async () => {
                await fix.httpClient
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
                await fix.httpClient
                    .get('/theaters')
                    .query({ wrong: 'value' })
                    .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
            })
        })

        // `name` 부분 문자열이 제공된 경우
        describe('when a partial `name` is provided', () => {
            // 이름이 해당 부분 문자열을 포함하는 극장 목록을 반환한다
            it('returns the theater list whose name contains the given substring', async () => {
                await fix.httpClient
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
