import { HttpTestClient, nullDate } from 'testlib'

describe('RequestValidationPipe', () => {
    let teardownFn = () => {}
    let client: HttpTestClient

    beforeEach(async () => {
        const { createFixture } = await import('./request-validation.pipe.fixture')
        const fixture = await createFixture()
        teardownFn = fixture.teardown
        client = fixture.client
    })

    afterEach(async () => {
        await teardownFn()
    })

    describe('object', () => {
        // 페이로드가 유효하면 검증을 통과한다
        it('passes validation when payload is valid', async () => {
            await client.post('/').body({ sampleId: 'id', date: nullDate }).created()
        })

        // 잘못된/알 수 없는 필드가 포함되면 400 Bad Request를 반환한다
        it('returns 400 Bad Request for invalid or unknown fields', async () => {
            await client.post('/').body({ wrong: 'id' }).badRequest()
        })
    })

    describe('array', () => {
        // 배열이 유효하면 검증을 통과한다
        it('passes validation when array payload is valid', async () => {
            await client
                .post('/array')
                .body([{ sampleId: 'id', date: nullDate }])
                .created()
        })

        // 배열 항목 중 하나라도 유효하지 않으면 400 Bad Request를 반환한다
        it('returns 400 Bad Request when any item is invalid', async () => {
            await client
                .post('/array')
                .body([{ sampleId: 'id', date: 'wrong' }])
                .badRequest()
        })
    })

    describe('nested array', () => {
        // 중첩 배열이 유효하면 검증을 통과한다
        it('passes validation when nested array payload is valid', async () => {
            await client
                .post('/nested')
                .body({ samples: [{ sampleId: 'id', date: nullDate }] })
                .created()
        })

        // 중첩 배열 항목 중 하나라도 유효하지 않으면 400 Bad Request를 반환한다
        it('returns 400 Bad Request when any nested item is invalid', async () => {
            await client
                .post('/nested')
                .body({ samples: [{ sampleId: 'id', date: 'wrong' }] })
                .badRequest()
        })
    })
})
