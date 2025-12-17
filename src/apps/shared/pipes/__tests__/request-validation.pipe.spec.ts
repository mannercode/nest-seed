import { nullDate } from 'testlib'
import type { RequestValidationPipeFixture } from './request-validation.pipe.fixture'

describe('RequestValidationPipe', () => {
    let fix: RequestValidationPipeFixture

    beforeEach(async () => {
        const { createRequestValidationPipeFixture } =
            await import('./request-validation.pipe.fixture')
        fix = await createRequestValidationPipeFixture()
    })

    afterEach(async () => {
        await fix.teardown()
    })

    describe('object', () => {
        describe('when the payload is valid', () => {
            it('passes validation', async () => {
                await fix.httpClient.post('/').body({ sampleId: 'id', date: nullDate }).created()
            })
        })

        describe('when the payload includes invalid or unknown fields', () => {
            it('returns 400 Bad Request', async () => {
                await fix.httpClient.post('/').body({ wrong: 'id' }).badRequest()
            })
        })
    })

    describe('array', () => {
        describe('when the payload is a valid array', () => {
            it('passes validation', async () => {
                await fix.httpClient
                    .post('/array')
                    .body([{ sampleId: 'id', date: nullDate }])
                    .created()
            })
        })

        describe('when any item is invalid', () => {
            it('returns 400 Bad Request', async () => {
                await fix.httpClient
                    .post('/array')
                    .body([{ sampleId: 'id', date: 'wrong' }])
                    .badRequest()
            })
        })
    })

    describe('nested array', () => {
        describe('when the payload is a valid nested array', () => {
            it('passes validation', async () => {
                await fix.httpClient
                    .post('/nested')
                    .body({ samples: [{ sampleId: 'id', date: nullDate }] })
                    .created()
            })
        })

        describe('when any nested item is invalid', () => {
            it('returns 400 Bad Request', async () => {
                await fix.httpClient
                    .post('/nested')
                    .body({ samples: [{ sampleId: 'id', date: 'wrong' }] })
                    .badRequest()
            })
        })
    })
})
