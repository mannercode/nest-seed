import { HttpTestClient, nullDate } from 'testlib'

// TODO

describe('RequestValidationPipe', () => {
    let teardown = () => {}
    let client: HttpTestClient

    beforeEach(async () => {
        const { createFixture } = await import('./request-validation.pipe.fixture')

        const fixture = await createFixture()
        teardown = fixture.teardown
        client = fixture.client
    })

    afterEach(async () => {
        await teardown()
    })

    // 배열의 각 필드가 올바른지 검증해야 한다
    it('Should validate each field in the array', async () => {
        await client
            .post('/array')
            .body([{ sampleId: 'id', date: nullDate }])
            .created([{ sampleId: 'id', date: nullDate }])
    })

    // 필드가 올바른지 검증해야 한다
    it('Should validate the fields', async () => {
        await client
            .post('/')
            .body({ sampleId: 'id', date: nullDate })
            .created({ sampleId: 'id', date: nullDate })
    })

    // 잘못된 필드를 전송하면 Bad Request를 반환해야 한다
    it('Should return Bad Request if invalid fields are sent', async () => {
        await client.post('/').body({ wrong: 'id' }).badRequest()
    })

    // 잘못된 필드를 배열로 전송하면 Bad Request를 반환해야 한다
    it('Should return Bad Request if invalid fields are sent as an array', async () => {
        await client
            .post('/array')
            .body([{ sampleId: 'id', date: 'wrong' }])
            .badRequest()
    })

    // 중첩된 배열의 각 필드가 올바른지 검증해야 한다
    it('Should validate each field in the nested array', async () => {
        const sample = { sampleId: 'id', date: nullDate }
        await client
            .post('/nested')
            .body({ samples: [sample] })
            .created([sample])
    })

    // 잘못된 필드를 중첩된 배열로 전송하면 Bad Request를 반환해야 한다
    it('Should return Bad Request if invalid fields are sent in a nested array', async () => {
        const sample = { sampleId: 'id', date: 'wrong' }
        await client
            .post('/nested')
            .body({ samples: [sample] })
            .badRequest()
    })
})
