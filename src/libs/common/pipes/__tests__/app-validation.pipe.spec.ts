import { APP_PIPE } from '@nestjs/core'
import { AppValidationPipe } from 'common'
import { HttpTestClient, HttpTestContext, createHttpTestContext } from 'testlib'
import { SamplesModule } from './app-validation.pipe.fixture'

describe('AppValidationPipe', () => {
    let testContext: HttpTestContext
    let client: HttpTestClient

    beforeEach(async () => {
        testContext = await createHttpTestContext({
            imports: [SamplesModule],
            providers: [{ provide: APP_PIPE, useClass: AppValidationPipe }]
        })
        client = testContext.client
    })

    afterEach(async () => {
        await testContext?.close()
    })

    it('필드가 올바른지 검증해야 한다', async () => {
        await client.post('/').body({ sampleId: 'id' }).created({ sampleId: 'id' })
    })

    it('잘못된 필드를 전송하면 Bad Request를 반환해야 한다', async () => {
        await client
            .post('/')
            .body({ wrong: 'id' })
            .badRequest({
                code: 'ERR_VALIDATION_FAILED',
                details: [
                    {
                        constraints: { whitelistValidation: 'property wrong should not exist' },
                        field: 'wrong'
                    },
                    {
                        constraints: {
                            isNotEmpty: 'sampleId should not be empty',
                            isString: 'sampleId must be a string'
                        },
                        field: 'sampleId'
                    }
                ],
                message: 'Validation failed'
            })
    })
})
