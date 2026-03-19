import { nullDate } from '@mannercode/nest-testing'
import type { RequestValidationPipeFixture } from './request-validation.pipe.fixture'

describe('RequestValidationPipe', () => {
    let fix: RequestValidationPipeFixture

    beforeEach(async () => {
        const { createRequestValidationPipeFixture } =
            await import('./request-validation.pipe.fixture')
        fix = await createRequestValidationPipeFixture()
    })
    afterEach(() => fix.teardown())

    describe('object', () => {
        // 페이로드가 유효할 때
        describe('when the payload is valid', () => {
            // 검증을 통과한다
            it('passes validation', async () => {
                await fix.httpClient.post('/').body({ date: nullDate, sampleId: 'id' }).created()
            })
        })

        // 페이로드에 유효하지 않거나 알 수 없는 필드가 포함될 때
        describe('when the payload includes invalid or unknown fields', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                await fix.httpClient.post('/').body({ wrong: 'id' }).badRequest()
            })
        })
    })

    describe('array', () => {
        // 페이로드가 유효한 배열일 때
        describe('when the payload is a valid array', () => {
            // 검증을 통과한다
            it('passes validation', async () => {
                await fix.httpClient
                    .post('/array')
                    .body([{ date: nullDate, sampleId: 'id' }])
                    .created()
            })
        })

        // 항목 중 하나라도 유효하지 않을 때
        describe('when any item is invalid', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                await fix.httpClient
                    .post('/array')
                    .body([{ date: 'wrong', sampleId: 'id' }])
                    .badRequest()
            })
        })
    })

    describe('nested array', () => {
        // 페이로드가 유효한 중첩 배열일 때
        describe('when the payload is a valid nested array', () => {
            // 검증을 통과한다
            it('passes validation', async () => {
                await fix.httpClient
                    .post('/nested')
                    .body({ samples: [{ date: nullDate, sampleId: 'id' }] })
                    .created()
            })
        })

        // 중첩 항목 중 하나라도 유효하지 않을 때
        describe('when any nested item is invalid', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                await fix.httpClient
                    .post('/nested')
                    .body({ samples: [{ date: 'wrong', sampleId: 'id' }] })
                    .badRequest()
            })
        })
    })
})
