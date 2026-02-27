import type { SearchTheatersPageDto, TheaterDto } from 'apps/cores'
import { buildCreateTheaterDto, createTheater, Errors } from 'apps/__tests__/__helpers__'
import { nullObjectId } from 'testlib'
import type { TheatersFixture } from './theaters.fixture'

describe('TheatersService', () => {
    let fix: TheatersFixture

    beforeEach(async () => {
        const { createTheatersFixture } = await import('./theaters.fixture')
        fix = await createTheatersFixture()
    })
    afterEach(() => fix.teardown())

    describe('POST /theaters', () => {
        // 생성된 극장을 반환한다
        it('returns the created theater', async () => {
            const createDto = buildCreateTheaterDto()

            await fix.httpClient
                .post('/theaters')
                .body(createDto)
                .created({ ...createDto, id: expect.any(String) })
        })

        // 필수 필드가 누락되었을 때
        describe('when required fields are missing', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                await fix.httpClient
                    .post('/theaters')
                    .body({})
                    .badRequest(Errors.RequestValidation.Failed(expect.any(Array)))
            })
        })
    })

    describe('GET /theaters/:id', () => {
        // 극장이 존재할 때
        describe('when the theater exists', () => {
            let theater: TheaterDto

            beforeEach(async () => {
                theater = await createTheater(fix)
            })

            // 극장을 반환한다
            it('returns the theater', async () => {
                await fix.httpClient.get(`/theaters/${theater.id}`).ok(theater)
            })
        })

        // 극장이 존재하지 않을 때
        describe('when the theater does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .get(`/theaters/${nullObjectId}`)
                    .notFound(Errors.Mongoose.MultipleDocumentsNotFound([nullObjectId]))
            })
        })
    })

    describe('PATCH /theaters/:id', () => {
        // 극장이 존재할 때
        describe('when the theater exists', () => {
            let theater: TheaterDto

            beforeEach(async () => {
                theater = await createTheater(fix, { name: 'original-name' })
            })

            // 수정된 극장을 반환한다
            it('returns the updated theater', async () => {
                const updateDto = {
                    location: { latitude: 30.0, longitude: 120.0 },
                    seatmap: { blocks: [] }
                }

                await fix.httpClient
                    .patch(`/theaters/${theater.id}`)
                    .body(updateDto)
                    .ok({ ...theater, ...updateDto })
            })

            // 수정 내용이 저장된다
            it('persists the update', async () => {
                const updateDto = { name: 'update-name' }
                await fix.httpClient.patch(`/theaters/${theater.id}`).body(updateDto).ok()

                await fix.httpClient.get(`/theaters/${theater.id}`).ok({ ...theater, ...updateDto })
            })
        })

        // 극장이 존재하지 않을 때
        describe('when the theater does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .patch(`/theaters/${nullObjectId}`)
                    .body({})
                    .notFound(Errors.Mongoose.DocumentNotFound(nullObjectId))
            })
        })
    })

    describe('DELETE /theaters/:id', () => {
        // 극장이 존재할 때
        describe('when the theater exists', () => {
            let theater: TheaterDto

            beforeEach(async () => {
                theater = await createTheater(fix)
            })

            // 204 No Content를 반환한다
            it('returns 204 No Content', async () => {
                await fix.httpClient.delete(`/theaters/${theater.id}`).noContent()
            })

            // 삭제가 저장된다
            it('persists the deletion', async () => {
                await fix.httpClient.delete(`/theaters/${theater.id}`).noContent()

                await fix.httpClient
                    .get(`/theaters/${theater.id}`)
                    .notFound(Errors.Mongoose.MultipleDocumentsNotFound([theater.id]))
            })
        })

        // 극장이 존재하지 않을 때
        describe('when the theater does not exist', () => {
            // 204 No Content를 반환한다
            it('returns 204 No Content', async () => {
                await fix.httpClient.delete(`/theaters/${nullObjectId}`).noContent()
            })
        })
    })

    describe('GET /theaters', () => {
        let theaterA1: TheaterDto
        let theaterA2: TheaterDto
        let theaterB1: TheaterDto
        let theaterB2: TheaterDto

        beforeEach(async () => {
            const createdTheaters = await Promise.all([
                createTheater(fix, { name: 'theater-a1' }),
                createTheater(fix, { name: 'theater-a2' }),
                createTheater(fix, { name: 'theater-b1' }),
                createTheater(fix, { name: 'theater-b2' })
            ])
            theaterA1 = createdTheaters[0]
            theaterA2 = createdTheaters[1]
            theaterB1 = createdTheaters[2]
            theaterB2 = createdTheaters[3]
        })

        const buildExpectedPage = (theaters: TheaterDto[]) => ({
            items: expect.arrayContaining(theaters),
            skip: 0,
            take: expect.any(Number),
            total: theaters.length
        })

        // 쿼리가 제공되지 않을 때
        describe('when the query is not provided', () => {
            // 기본 페이지를 반환한다
            it('returns the default page', async () => {
                const expected = buildExpectedPage([theaterA1, theaterA2, theaterB1, theaterB2])

                await fix.httpClient.get('/theaters').ok(expected)
            })
        })

        // 필터가 제공될 때
        describe('when the filter is provided', () => {
            const queryAndExpect = (query: SearchTheatersPageDto, theaters: TheaterDto[]) =>
                fix.httpClient.get('/theaters').query(query).ok(buildExpectedPage(theaters))

            // 부분 이름 일치로 필터링된 극장을 반환한다
            it('returns theaters filtered by a partial name match', async () => {
                await queryAndExpect({ name: 'theater-a' }, [theaterA1, theaterA2])
            })
        })

        // 쿼리 파라미터가 유효하지 않을 때
        describe('when the query parameters are invalid', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                await fix.httpClient
                    .get('/theaters')
                    .query({ wrong: 'value' })
                    .badRequest(Errors.RequestValidation.Failed(expect.any(Array)))
            })
        })
    })
})
