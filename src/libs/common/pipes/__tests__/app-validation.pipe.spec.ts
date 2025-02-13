import { APP_PIPE } from '@nestjs/core'
import { AppValidationPipe } from 'common'
import { createHttpTestContext, HttpTestClient, TestContext } from 'testlib'
import { SamplesModule } from './app-validation.pipe.fixture'

describe('AppValidationPipe', () => {
    let testContext: TestContext
    let client: HttpTestClient

    beforeEach(async () => {
        testContext = await createHttpTestContext({
            imports: [SamplesModule],
            providers: [{ provide: APP_PIPE, useClass: AppValidationPipe }]
        })

        client = new HttpTestClient(`http://localhost:${testContext.httpPort}`)
    })

    afterEach(async () => {
        await testContext?.close()
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

    it('배열의 각 필드가 올바른지 검증해야 한다', async () => {
        await client
            .post('/array')
            .body([{ sampleId: 'id', date: new Date(0) }])
            .created([{ sampleId: 'id', date: new Date(0) }])
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
