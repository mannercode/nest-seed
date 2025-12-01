import { nullDate } from 'testlib'
import type { RequestValidationPipeFixture } from './request-validation.pipe.fixture'

describe('RequestValidationPipe', () => {
    let fixture: RequestValidationPipeFixture

    beforeEach(async () => {
        const { createRequestValidationPipeFixture } =
            await import('./request-validation.pipe.fixture')
        fixture = await createRequestValidationPipeFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('object', () => {
        it('passes validation when payload is valid', async () => {
            await fixture.httpClient.post('/').body({ sampleId: 'id', date: nullDate }).created()
        })

        it('returns 400 Bad Request for invalid or unknown fields', async () => {
            await fixture.httpClient.post('/').body({ wrong: 'id' }).badRequest()
        })
    })

    describe('array', () => {
        it('passes validation when array payload is valid', async () => {
            await fixture.httpClient
                .post('/array')
                .body([{ sampleId: 'id', date: nullDate }])
                .created()
        })

        it('returns 400 Bad Request when any item is invalid', async () => {
            await fixture.httpClient
                .post('/array')
                .body([{ sampleId: 'id', date: 'wrong' }])
                .badRequest()
        })
    })

    describe('nested array', () => {
        it('passes validation when nested array payload is valid', async () => {
            await fixture.httpClient
                .post('/nested')
                .body({ samples: [{ sampleId: 'id', date: nullDate }] })
                .created()
        })

        it('returns 400 Bad Request when any nested item is invalid', async () => {
            await fixture.httpClient
                .post('/nested')
                .body({ samples: [{ sampleId: 'id', date: 'wrong' }] })
                .badRequest()
        })
    })
})
