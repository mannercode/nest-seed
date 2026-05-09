import type { SearchTheatersPageDto, TheaterDto } from 'cores'
import { nullObjectId } from '@mannercode/testing'
import type { TheatersFixture } from './theaters.fixture'
import { buildCreateTheaterDto, createTheater, Errors } from '../__helpers__'

describe('TheatersService', () => {
    let fix: TheatersFixture

    beforeEach(async () => {
        const { createTheatersFixture } = await import('./theaters.fixture')
        fix = await createTheatersFixture()
    })
    afterEach(() => fix.teardown())

    describe('POST /theaters', () => {
        it('생성된 극장을 반환한다', async () => {
            const createDto = buildCreateTheaterDto()

            await fix.httpClient
                .post('/theaters')
                .body(createDto)
                .created({ ...createDto, id: expect.any(String) })
        })

        describe('필수 필드가 누락되었을 때', () => {
            it('400 Bad Request를 반환한다', async () => {
                await fix.httpClient
                    .post('/theaters')
                    .body({})
                    .badRequest(Errors.RequestValidation.Failed(expect.any(Array)))
            })
        })
    })

    describe('GET /theaters/:id', () => {
        describe('극장이 존재할 때', () => {
            let theater: TheaterDto

            beforeEach(async () => {
                theater = await createTheater(fix)
            })

            it('극장을 반환한다', async () => {
                await fix.httpClient.get(`/theaters/${theater.id}`).ok(theater)
            })
        })

        describe('극장이 존재하지 않을 때', () => {
            it('404 Not Found를 반환한다', async () => {
                await fix.httpClient
                    .get(`/theaters/${nullObjectId}`)
                    .notFound(Errors.Mongoose.MultipleDocumentsNotFound([nullObjectId]))
            })
        })
    })

    describe('PATCH /theaters/:id', () => {
        describe('극장이 존재할 때', () => {
            let theater: TheaterDto

            beforeEach(async () => {
                theater = await createTheater(fix, { name: 'original-name' })
            })

            it('수정된 극장을 반환한다', async () => {
                const updateDto = {
                    location: { latitude: 30.0, longitude: 120.0 },
                    seatmap: { blocks: [] }
                }

                await fix.httpClient
                    .patch(`/theaters/${theater.id}`)
                    .body(updateDto)
                    .ok({ ...theater, ...updateDto })
            })

            it('수정 내용이 저장된다', async () => {
                const updateDto = { name: 'update-name' }
                await fix.httpClient.patch(`/theaters/${theater.id}`).body(updateDto).ok()

                await fix.httpClient.get(`/theaters/${theater.id}`).ok({ ...theater, ...updateDto })
            })
        })

        describe('극장이 존재하지 않을 때', () => {
            it('404 Not Found를 반환한다', async () => {
                await fix.httpClient
                    .patch(`/theaters/${nullObjectId}`)
                    .body({})
                    .notFound(Errors.Mongoose.DocumentNotFound(nullObjectId))
            })
        })
    })

    describe('DELETE /theaters/:id', () => {
        describe('극장이 존재할 때', () => {
            let theater: TheaterDto

            beforeEach(async () => {
                theater = await createTheater(fix)
            })

            it('204 No Content를 반환한다', async () => {
                await fix.httpClient.delete(`/theaters/${theater.id}`).noContent()
            })

            it('삭제가 저장된다', async () => {
                await fix.httpClient.delete(`/theaters/${theater.id}`).noContent()

                await fix.httpClient
                    .get(`/theaters/${theater.id}`)
                    .notFound(Errors.Mongoose.MultipleDocumentsNotFound([theater.id]))
            })
        })

        describe('극장이 존재하지 않을 때', () => {
            it('204 No Content를 반환한다', async () => {
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
            page: expect.any(Number),
            size: expect.any(Number),
            total: theaters.length
        })

        describe('쿼리가 제공되지 않을 때', () => {
            it('기본 페이지를 반환한다', async () => {
                const expected = buildExpectedPage([theaterA1, theaterA2, theaterB1, theaterB2])

                await fix.httpClient.get('/theaters').ok(expected)
            })
        })

        describe('필터가 제공될 때', () => {
            const queryAndExpect = (query: SearchTheatersPageDto, theaters: TheaterDto[]) =>
                fix.httpClient.get('/theaters').query(query).ok(buildExpectedPage(theaters))

            it('부분 이름 일치로 필터링된 극장을 반환한다', async () => {
                await queryAndExpect({ name: 'theater-a' }, [theaterA1, theaterA2])
            })
        })

        describe('쿼리 파라미터가 유효하지 않을 때', () => {
            it('400 Bad Request를 반환한다', async () => {
                await fix.httpClient
                    .get('/theaters')
                    .query({ wrong: 'value' })
                    .badRequest(Errors.RequestValidation.Failed(expect.any(Array)))
            })
        })
    })
})
