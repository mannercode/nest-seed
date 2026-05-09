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

    describe('객체', () => {
        it('유효한 페이로드는 검증을 통과한다', async () => {
            await fix.httpClient.post('/').body({ date: nullDate, sampleId: 'id' }).created()
        })

        it('유효하지 않거나 알 수 없는 필드가 있으면 400을 반환한다', async () => {
            await fix.httpClient.post('/').body({ wrong: 'id' }).badRequest()
        })
    })

    describe('배열', () => {
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

    describe('중첩 배열', () => {
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
