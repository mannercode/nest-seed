import type { TheaterDto } from 'core'
import { nullObjectId } from '@mannercode/testing'
import type { TheatersFixture } from './theaters.fixture'
import { buildCreateTheaterDto, createTheater, Errors } from '../helpers'

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

        it('필수 필드가 누락되면 400을 반환한다', async () => {
            await fix.httpClient
                .post('/theaters')
                .body({})
                .badRequest(Errors.RequestValidation.Failed(expect.any(Array)))
        })
    })

    describe('GET /theaters/:id', () => {
        it('id에 해당하는 극장을 반환한다', async () => {
            const theater = await createTheater(fix)

            await fix.httpClient.get(`/theaters/${theater.id}`).ok(theater)
        })

        it('id에 해당하는 극장이 없으면 404를 반환한다', async () => {
            await fix.httpClient
                .get(`/theaters/${nullObjectId}`)
                .notFound(Errors.Mongoose.MultipleDocumentsNotFound([nullObjectId]))
        })
    })

    describe('PATCH /theaters/:id', () => {
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

        it('수정 내용이 영속된다', async () => {
            const updateDto = { name: 'update-name' }
            await fix.httpClient.patch(`/theaters/${theater.id}`).body(updateDto).ok()

            await fix.httpClient.get(`/theaters/${theater.id}`).ok({ ...theater, ...updateDto })
        })

        it('id에 해당하는 극장이 없으면 404를 반환한다', async () => {
            await fix.httpClient
                .patch(`/theaters/${nullObjectId}`)
                .body({})
                .notFound(Errors.Mongoose.DocumentNotFound(nullObjectId))
        })
    })

    describe('DELETE /theaters/:id', () => {
        it('극장이 존재하면 204를 반환한다', async () => {
            const theater = await createTheater(fix)

            await fix.httpClient.delete(`/theaters/${theater.id}`).noContent()
        })

        it('삭제 후에는 조회 시 404가 반환된다', async () => {
            const theater = await createTheater(fix)

            await fix.httpClient.delete(`/theaters/${theater.id}`).noContent()

            await fix.httpClient
                .get(`/theaters/${theater.id}`)
                .notFound(Errors.Mongoose.MultipleDocumentsNotFound([theater.id]))
        })

        it('극장이 없어도 204를 반환한다', async () => {
            await fix.httpClient.delete(`/theaters/${nullObjectId}`).noContent()
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

        it('쿼리가 없으면 전체 극장 페이지를 반환한다', async () => {
            const expected = buildExpectedPage([theaterA1, theaterA2, theaterB1, theaterB2])

            await fix.httpClient.get('/theaters').ok(expected)
        })

        it('name 부분 일치로 필터링한다', async () => {
            await fix.httpClient
                .get('/theaters')
                .query({ name: 'theater-a' })
                .ok(buildExpectedPage([theaterA1, theaterA2]))
        })

        it('알 수 없는 쿼리 파라미터는 400을 반환한다', async () => {
            await fix.httpClient
                .get('/theaters')
                .query({ wrong: 'value' })
                .badRequest(Errors.RequestValidation.Failed(expect.any(Array)))
        })
    })
})
