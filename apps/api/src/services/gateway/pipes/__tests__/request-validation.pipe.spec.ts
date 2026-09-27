import { nullDate } from '@mannercode/testing'
import { RequestValidationPipe } from '../index.js'
import {
    createRequestValidationPipeFixture,
    type RequestValidationPipeFixture
} from './request-validation.pipe.fixture.js'

describe('RequestValidationPipe HTTP 및 오류 변환', () => {
    let fix: RequestValidationPipeFixture

    beforeEach(async () => {
        fix = await createRequestValidationPipeFixture()
    })
    afterEach(() => fix.teardown())

    it('경로가 없는 스키마 오류는 field가 빈 문자열인 예외로 변환해 던진다', async () => {
        const schema = {
            '~standard': {
                validate: () => ({ issues: [{ message: 'root validation failed' }] }),
                vendor: 'test',
                version: 1 as const
            }
        }

        await expect(
            new RequestValidationPipe().transform({}, { schema, type: 'body' })
        ).rejects.toMatchObject({
            response: {
                code: 'ERR_REQUEST_VALIDATION_FAILED',
                details: [{ constraints: { validation: 'root validation failed' }, field: '' }],
                message: 'Validation failed'
            }
        })
    })

    describe('POST /', () => {
        it('유효한 본문으로 요청하면 201을 반환한다', async () => {
            await fix.httpClient.post('/').body({ date: nullDate, sampleId: 'id' }).created()
        })

        it('알 수 없는 필드가 있으면 400을 반환한다', async () => {
            await fix.httpClient
                .post('/')
                .body({ date: nullDate, sampleId: 'id', unknown: 'x' })
                .badRequest({
                    expected: {
                        code: 'ERR_REQUEST_VALIDATION_FAILED',
                        details: [
                            { constraints: { validation: expect.any(String) }, field: 'unknown' }
                        ],
                        message: 'Validation failed'
                    }
                })
        })

        // 응답을 만드는 함수로 예상값까지 만들면 같은 오류를 놓칠 수 있으므로, 기대하는 JSON을 직접 적는다.
        it('필수 필드가 누락되면 필드명과 검증 오류를 담은 400 응답을 반환한다', async () => {
            await fix.httpClient
                .post('/')
                .body({ date: nullDate })
                .badRequest({
                    expected: {
                        code: 'ERR_REQUEST_VALIDATION_FAILED',
                        details: [
                            { constraints: { validation: expect.any(String) }, field: 'sampleId' }
                        ],
                        message: 'Validation failed'
                    }
                })
        })
    })

    describe('POST /array', () => {
        it('유효한 배열로 요청하면 201을 반환한다', async () => {
            await fix.httpClient
                .post('/array')
                .body([{ date: nullDate, sampleId: 'id' }])
                .created()
        })

        it('배열 항목의 날짜가 잘못되면 400을 반환한다', async () => {
            await fix.httpClient
                .post('/array')
                .body([{ date: 'wrong', sampleId: 'id' }])
                .badRequest()
        })
    })

    describe('POST /nested', () => {
        it('유효한 중첩 배열로 요청하면 201을 반환한다', async () => {
            await fix.httpClient
                .post('/nested')
                .body({ samples: [{ date: nullDate, sampleId: 'id' }] })
                .created()
        })

        it('중첩 배열 항목의 날짜가 잘못되면 400을 반환한다', async () => {
            await fix.httpClient
                .post('/nested')
                .body({ samples: [{ date: 'wrong', sampleId: 'id' }] })
                .badRequest()
        })
    })
})
