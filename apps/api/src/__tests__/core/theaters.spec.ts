import { paginationResultSchema } from '@mannercode/common'
import { nullObjectId } from '@mannercode/testing'
import { type TheaterDto, TheatersService, TheaterSchema } from '#core'
import {
    buildCreateTheaterDto,
    createShowtimes,
    createTheater,
    Errors,
    type AppTestContext,
    createAppTestContext
} from '../helpers/index.js'
import { AdminAuthGuard } from '#gateway'

describe('TheatersService', () => {
    let fix: AppTestContext
    let teardown: AppTestContext['teardown'] | undefined

    beforeEach(async () => {
        teardown = undefined

        fix = await createAppTestContext({ ignoreGuards: [AdminAuthGuard] })
        teardown = fix.teardown
    })
    afterEach(() => teardown?.())

    describe('POST /theaters', () => {
        it('생성된 극장을 반환한다', async () => {
            const createDto = buildCreateTheaterDto()

            await fix.httpClient
                .post('/theaters')
                .body(createDto)
                .created({
                    schema: TheaterSchema,
                    expected: { ...createDto, id: expect.any(String) }
                })
        })

        describe('요청 본문에 필수 필드가 없으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.post('/theaters').body({})
            })
            it('극장 생성을 요청하면 400을 반환한다', async () => {
                await request.badRequest({
                    expected: Errors.RequestValidation.Failed(expect.any(Array))
                })
            })
        })

        describe('요청한 좌석 배치에서 같은 행의 좌석 좌표가 중복되면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                const createDto = buildCreateTheaterDto({
                    seatmap: {
                        blocks: [
                            {
                                name: 'A',
                                rows: [
                                    { name: '1', layout: 'O' },
                                    { name: '1', layout: 'O' }
                                ]
                            }
                        ]
                    }
                })
                request = fix.httpClient.post('/theaters').body(createDto)
            })
            it('극장 생성을 요청하면 400을 반환한다', async () => {
                await request.badRequest({
                    expected: Errors.RequestValidation.Failed(expect.any(Array))
                })
            })
        })
    })

    describe('GET /theaters/:id', () => {
        describe('극장이 존재하면', () => {
            let theater: TheaterDto
            beforeEach(async () => {
                theater = await createTheater(fix)
            })
            it('ID로 해당 극장을 조회할 수 있다', async () => {
                await fix.httpClient
                    .get(`/theaters/${theater.id}`)
                    .ok({ schema: TheaterSchema, expected: theater })
            })
        })

        describe('ID에 해당하는 극장이 없으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get(`/theaters/${nullObjectId}`)
            })
            it('극장을 조회하면 404를 반환한다', async () => {
                await request.notFound({
                    expected: Errors.Mongo.MultipleDocumentsNotFound([nullObjectId])
                })
            })
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
                .ok({ schema: TheaterSchema, expected: { ...theater, ...updateDto } })
        })

        it('수정 내용이 DB에 저장된다', async () => {
            const updateDto = { name: 'update-name' }
            await fix.httpClient
                .patch(`/theaters/${theater.id}`)
                .body(updateDto)
                .ok({ schema: TheaterSchema })

            await fix.httpClient
                .get(`/theaters/${theater.id}`)
                .ok({ schema: TheaterSchema, expected: { ...theater, ...updateDto } })
        })

        describe('요청한 좌석 배치에서 블록 사이에 좌석 좌표가 중복되면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.patch(`/theaters/${theater.id}`).body({
                    seatmap: {
                        blocks: [
                            { name: 'A', rows: [{ name: '1', layout: 'O' }] },
                            { name: 'A', rows: [{ name: '1', layout: 'O' }] }
                        ]
                    }
                })
            })
            it('극장 수정을 요청하면 400을 반환하고 기존 배치를 유지한다', async () => {
                await request.badRequest({
                    expected: Errors.RequestValidation.Failed(expect.any(Array))
                })

                await fix.httpClient
                    .get(`/theaters/${theater.id}`)
                    .ok({ schema: TheaterSchema, expected: theater })
            })
        })

        describe('ID에 해당하는 극장이 없으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.patch(`/theaters/${nullObjectId}`).body({})
            })
            it('극장 수정을 요청하면 404를 반환한다', async () => {
                await request.notFound({ expected: Errors.Mongo.DocumentNotFound(nullObjectId) })
            })
        })
    })

    describe('DELETE /theaters/:id', () => {
        describe('상영이 없는 극장이 존재하면', () => {
            let theater: TheaterDto
            beforeEach(async () => {
                theater = await createTheater(fix)
            })
            it('204를 반환하고 삭제 후 조회에는 404를 반환한다', async () => {
                await fix.httpClient.delete(`/theaters/${theater.id}`).noContent()

                await fix.httpClient
                    .get(`/theaters/${theater.id}`)
                    .notFound({ expected: Errors.Mongo.MultipleDocumentsNotFound([theater.id]) })
            })
        })

        describe('상영이 등록된 극장이 있으면', () => {
            let theater: TheaterDto
            beforeEach(async () => {
                theater = await createTheater(fix)
                await createShowtimes(fix, [{ theaterId: theater.id }])
            })
            it('극장 삭제 요청에 409를 반환한다', async () => {
                await fix.httpClient
                    .delete(`/theaters/${theater.id}`)
                    .conflict({ expected: Errors.Theaters.DeleteBlockedByShowtimes(theater.id) })
            })
        })

        describe('ID에 해당하는 극장이 없으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.delete(`/theaters/${nullObjectId}`)
            })
            it('극장 삭제를 요청하면 204를 반환한다', async () => {
                await request.noContent()
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

        describe('검색 조건이 없으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/theaters')
            })
            it('극장 목록을 조회하면 전체 극장 페이지를 반환한다', async () => {
                const expected = buildExpectedPage([theaterA1, theaterA2, theaterB1, theaterB2])

                await request.ok({ schema: paginationResultSchema(TheaterSchema), expected })
            })
        })

        describe('극장 이름의 일부를 검색 조건으로 지정했으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/theaters').query({ name: 'theater-a' })
            })
            it('목록을 조회하면 이름에 해당 문자열이 포함된 극장을 반환한다', async () => {
                await request.ok({
                    schema: paginationResultSchema(TheaterSchema),
                    expected: buildExpectedPage([theaterA1, theaterA2])
                })
            })
        })

        describe('정의하지 않은 쿼리 파라미터가 있으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/theaters').query({ wrong: 'value' })
            })
            it('극장 목록을 조회하면 400을 반환한다', async () => {
                await request.badRequest({
                    expected: Errors.RequestValidation.Failed(expect.any(Array))
                })
            })
        })
    })

    describe('update', () => {
        let theater: TheaterDto
        beforeEach(async () => {
            theater = await createTheater(fix, { name: 'original-name' })
        })
        describe('수정할 필수 필드 값이 null이면', () => {
            let update: { name: null }
            beforeEach(() => {
                update = { name: null }
            })
            it('극장을 수정하면 예외를 던지고 기존 값을 유지한다', async () => {
                const theatersService = fix.module.get(TheatersService)

                // @ts-expect-error 런타임 호출이 타입 계약을 어긴 경우를 검증한다.
                await expect(theatersService.update(theater.id, update)).rejects.toThrow()
                await fix.httpClient
                    .get(`/theaters/${theater.id}`)
                    .ok({ schema: TheaterSchema, expected: theater })
            })
        })
    })
})
