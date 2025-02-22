import { CloseFixture, HttpTestClient } from 'testlib'

describe('AppValidationPipe', () => {
    let closeFixture: CloseFixture
    let client: HttpTestClient

    beforeEach(async () => {
        const { createFixture } = await import('./app-validation.pipe.fixture')

        const fixture = await createFixture()
        closeFixture = fixture.closeFixture
        client = fixture.client
    })

    afterEach(async () => {
        await closeFixture?.()
    })

    it('배열의 각 필드가 올바른지 검증해야 한다', async () => {
        await client
            .post('/array')
            .body([{ sampleId: 'id', date: new Date(0) }])
            .created([{ sampleId: 'id', date: new Date(0) }])
    })

    it('필드가 올바른지 검증해야 한다', async () => {
        await client
            .post('/')
            .body({ sampleId: 'id', date: new Date(0) })
            .created({ sampleId: 'id', date: new Date(0) })
    })

    it('잘못된 필드를 전송하면 Bad Request를 반환해야 한다', async () => {
        await client.post('/').body({ wrong: 'id' }).badRequest()
    })

    it('잘못된 필드를 배열로 전송하면 Bad Request를 반환해야 한다', async () => {
        await client
            .post('/array')
            .body([{ sampleId: 'id', date: 'wrong' }])
            .badRequest()
    })

    it('중첩된 배열의 각 필드가 올바른지 검증해야 한다', async () => {
        const sample = { sampleId: 'id', date: new Date(0) }
        await client
            .post('/nested')
            .body({ samples: [sample] })
            .created([sample])
    })

    it('잘못된 필드를 중첩된 배열로 전송하면 Bad Request를 반환해야 한다', async () => {
        const sample = { sampleId: 'id', date: 'wrong' }
        await client
            .post('/nested')
            .body({ samples: [sample] })
            .badRequest()
    })
})
