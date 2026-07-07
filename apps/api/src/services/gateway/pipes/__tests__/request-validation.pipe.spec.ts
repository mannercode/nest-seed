import { nullDate } from '@mannercode/testing'
import type { RequestValidationPipeFixture } from './request-validation.pipe.fixture'

describe('RequestValidationPipe', () => {
    let fix: RequestValidationPipeFixture

    beforeEach(async () => {
        const { createRequestValidationPipeFixture } =
            await import('./request-validation.pipe.fixture')
        fix = await createRequestValidationPipeFixture()
    })
    afterEach(() => fix.teardown())

    describe('POST /', () => {
        it('유효한 페이로드는 검증을 통과한다', async () => {
            await fix.httpClient.post('/').body({ date: nullDate, sampleId: 'id' }).created()
        })

        it('알 수 없는 필드가 있으면 400을 반환한다', async () => {
            await fix.httpClient
                .post('/')
                .body({ date: nullDate, sampleId: 'id', unknown: 'x' })
                .badRequest()
        })

        it('필수 필드가 누락되면 400을 반환한다', async () => {
            await fix.httpClient.post('/').body({ date: nullDate }).badRequest()
        })

        // 프로덕션 팩토리 재사용은 동어반복이라 리터럴로 단언해 와이어 포맷을 고정한다.
        it('검증 실패 시 code·message·details[{ field, constraints }] 형식의 본문을 반환한다', async () => {
            await fix.httpClient
                .post('/')
                .body({ date: nullDate })
                .badRequest({
                    code: 'ERR_REQUEST_VALIDATION_FAILED',
                    details: [
                        {
                            constraints: {
                                isNotEmpty: expect.any(String),
                                isString: expect.any(String)
                            },
                            field: 'sampleId'
                        }
                    ],
                    message: 'Validation failed'
                })
        })
    })

    describe('POST /array', () => {
        it('유효한 배열은 검증을 통과한다', async () => {
            await fix.httpClient
                .post('/array')
                .body([{ date: nullDate, sampleId: 'id' }])
                .created()
        })

        it('배열 항목 중 하나라도 유효하지 않으면 400을 반환한다', async () => {
            await fix.httpClient
                .post('/array')
                .body([{ date: 'wrong', sampleId: 'id' }])
                .badRequest()
        })
    })

    describe('POST /nested', () => {
        it('유효한 중첩 배열은 검증을 통과한다', async () => {
            await fix.httpClient
                .post('/nested')
                .body({ samples: [{ date: nullDate, sampleId: 'id' }] })
                .created()
        })

        it('중첩 배열 항목 중 하나라도 유효하지 않으면 400을 반환한다', async () => {
            await fix.httpClient
                .post('/nested')
                .body({ samples: [{ date: 'wrong', sampleId: 'id' }] })
                .badRequest()
        })
    })
})
