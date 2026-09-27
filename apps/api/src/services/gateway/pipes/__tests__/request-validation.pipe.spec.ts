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

    describe('스키마가 필드 경로 없는 검증 오류를 반환하도록 설정하면', () => {
        let schema: NonNullable<Parameters<RequestValidationPipe['transform']>[1]['schema']>
        beforeEach(() => {
            schema = {
                '~standard': {
                    validate: () => ({ issues: [{ message: 'root validation failed' }] }),
                    vendor: 'test',
                    version: 1 as const
                }
            }
        })
        it('본문을 변환하면 field가 빈 문자열인 예외를 던진다', async () => {
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
    })

    describe('POST /', () => {
        describe('요청 본문이 스키마에 맞으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.post('/').body({ date: nullDate, sampleId: 'id' })
            })
            it('요청하면 201을 반환한다', async () => {
                await request.created()
            })
        })

        describe('요청 본문에 정의하지 않은 필드가 있으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient
                    .post('/')
                    .body({ date: nullDate, sampleId: 'id', unknown: 'x' })
            })
            it('요청하면 400을 반환한다', async () => {
                await request.badRequest({
                    expected: {
                        code: 'ERR_REQUEST_VALIDATION_FAILED',
                        details: [
                            { constraints: { validation: expect.any(String) }, field: 'unknown' }
                        ],
                        message: 'Validation failed'
                    }
                })
            })
        })

        // 응답을 만드는 함수로 예상값까지 만들면 같은 오류를 놓칠 수 있으므로, 기대하는 JSON을 직접 적는다.
        describe('요청 본문에 필수 필드가 없으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.post('/').body({ date: nullDate })
            })
            it('요청하면 필드명과 검증 오류를 담은 400을 반환한다', async () => {
                await request.badRequest({
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
    })

    describe('POST /array', () => {
        describe('요청 배열의 모든 항목이 스키마에 맞으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.post('/array').body([{ date: nullDate, sampleId: 'id' }])
            })
            it('요청하면 201을 반환한다', async () => {
                await request.created()
            })
        })

        describe('요청 배열 항목의 날짜가 잘못되었으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.post('/array').body([{ date: 'wrong', sampleId: 'id' }])
            })
            it('요청하면 400을 반환한다', async () => {
                await request.badRequest()
            })
        })
    })

    describe('POST /nested', () => {
        describe('요청 본문의 중첩 배열이 스키마에 맞으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient
                    .post('/nested')
                    .body({ samples: [{ date: nullDate, sampleId: 'id' }] })
            })
            it('요청하면 201을 반환한다', async () => {
                await request.created()
            })
        })

        describe('요청 본문의 중첩 배열 항목에 잘못된 날짜가 있으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient
                    .post('/nested')
                    .body({ samples: [{ date: 'wrong', sampleId: 'id' }] })
            })
            it('요청하면 400을 반환한다', async () => {
                await request.badRequest()
            })
        })
    })
})
