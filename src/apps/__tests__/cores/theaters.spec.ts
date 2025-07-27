import { TheaterDto } from 'apps/cores'
import { expectEqualUnsorted, nullObjectId } from 'testlib'
import { Errors } from '../__helpers__'
import { buildCreateTheaterDto, createTheater } from '../common.fixture'
import { Fixture } from './theaters.fixture'

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
        // 유효한 데이터일 때
        describe('when valid data', () => {
            // 새로운 극장을 생성한다.
            it('creates a new theater', async () => {
                const createDto = buildCreateTheaterDto()
                await fix.httpClient
                    .post('/theaters')
                    .body(createDto)
                    .created({ id: expect.any(String), ...createDto })
            })
        })

        // 필수 필드가 누락되었을 때
        describe('when required fields are missing', () => {
            // BadRequest(400) 에러를 반환한다.
            it('returns a BadRequest(400) error', async () => {
                await fix.httpClient
                    .post('/theaters')
                    .body({})
                    .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
            })
        })
    })

    describe('PATCH /theaters/:id', () => {
        let theater: TheaterDto

        beforeEach(async () => {
            theater = await createTheater(fix)
        })

        // 유효한 업데이트 데이터일 때
        describe('when given valid update data', () => {
            // 극장 정보를 수정한다.
            it('updates the theater details', async () => {
                const updateDto = {
                    name: 'update-name',
                    location: { latitude: 30.0, longitude: 120.0 },
                    seatmap: []
                }
                const expected = { ...theater, ...updateDto }

                await fix.httpClient.patch(`/theaters/${theater.id}`).body(updateDto).ok(expected)
                await fix.httpClient.get(`/theaters/${theater.id}`).ok(expected)
            })
        })

        // 빈 페이로드일 때
        describe('with an empty payload', () => {
            // 변경 없이 기존 극장 정보를 반환한다.
            it('returns the unchanged theater details', async () => {
                await fix.httpClient.patch(`/theaters/${theater.id}`).body({}).ok(theater)
            })
        })

        // 존재하지 않는 극장일 때
        describe('when the theater does not exist', () => {
            // 404 Not Found 에러를 반환한다.
            it('returns 404 Not Found error', async () => {
                await fix.httpClient
                    .patch(`/theaters/${nullObjectId}`)
                    .body({})
                    .notFound({ ...Errors.Mongoose.DocumentNotFound, notFoundId: nullObjectId })
            })
        })
    })

    describe('DELETE /theaters/:id', () => {
        let theater: TheaterDto

        beforeEach(async () => {
            theater = await createTheater(fix)
        })

        // 존재하는 극장일 때
        describe('when the theater exists', () => {
            // 극장을 삭제한다.
            it('deletes the theater', async () => {
                await fix.httpClient.delete(`/theaters/${theater.id}`).ok()
                await fix.httpClient.get(`/theaters/${theater.id}`).notFound({
                    ...Errors.Mongoose.MultipleDocumentsNotFound,
                    notFoundIds: [theater.id]
                })
            })
        })

        // 존재하지 않는 극장일 때
        describe('when the theater does not exist', () => {
            // 404 Not Found 에러를 반환한다.
            it('returns 404 Not Found error', async () => {
                await fix.httpClient.delete(`/theaters/${nullObjectId}`).notFound({
                    ...Errors.Mongoose.MultipleDocumentsNotFound,
                    notFoundIds: [nullObjectId]
                })
            })
        })
    })

    describe('GET /theaters/:id', () => {
        let theater: TheaterDto

        beforeEach(async () => {
            theater = await createTheater(fix)
        })

        // 존재하는 극장일 때
        describe('when the theater exists', () => {
            // 극장 상세 정보를 반환한다.
            it('returns the theater details', async () => {
                await fix.httpClient.get(`/theaters/${theater.id}`).ok(theater)
            })
        })

        // 존재하지 않는 극장일 때
        describe('when the theater does not exist', () => {
            // 404 Not Found 에러를 반환한다.
            it('returns 404 Not Found error', async () => {
                await fix.httpClient.get(`/theaters/${nullObjectId}`).notFound({
                    ...Errors.Mongoose.MultipleDocumentsNotFound,
                    notFoundIds: [nullObjectId]
                })
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

        // 쿼리 파라미터가 없을 때
        describe('when no query parameters are provided', () => {
            // 기본 페이지네이션으로 극장 목록을 반환한다.
            it('returns a paginated list of theaters', async () => {
                const { body } = await fix.httpClient.get('/theaters').ok()
                const { items, ...pagination } = body

                expect(pagination).toEqual({
                    skip: 0,
                    take: expect.any(Number),
                    total: theaters.length
                })
                expectEqualUnsorted(items, theaters)
            })
        })

        // 다양한 조건으로 필터링할 때
        describe('when filtering with various criteria', () => {
            // 부분 이름과 일치하는 영화 목록을 반환한다.
            it('returns theaters filtered by partial name', async () => {
                const partialName = 'Theater-a'
                const { body } = await fix.httpClient
                    .get('/theaters')
                    .query({ name: partialName })
                    .ok()

                expectEqualUnsorted(body.items, [theaters[0], theaters[1]])
            })
        })

        // 유효하지 않은 쿼리 파라미터일 때
        describe('when an invalid query parameter is provided', () => {
            // BadRequest(400) 에러를 반환한다.
            it('returns a BadRequest(400) error', async () => {
                await fix.httpClient
                    .get('/theaters')
                    .query({ wrong: 'value' })
                    .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
            })
        })
    })
})
