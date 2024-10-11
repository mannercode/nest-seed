import { HttpTestClient, HttpTestContext, createHttpTestContext } from '..'
import { SampleModule, SampleService } from './create-http-test-context.fixture'

describe('createHttpTestContext', () => {
    let testContext: HttpTestContext
    let client: HttpTestClient

    beforeEach(async () => {
        testContext = await createHttpTestContext({
            imports: [SampleModule],
            overrideProviders: [
                {
                    original: SampleService,
                    replacement: {
                        getMessage: jest.fn().mockReturnValue({ message: 'This is Mock' })
                    }
                }
            ]
        })

        client = testContext.client
    })

    afterEach(async () => {
        await testContext?.close()
    })

    it('overrideProviders에 설정한 서비스가 동작해야 한다', async () => {
        const res = await client.get('/').ok()

        expect(res.body).toEqual({ message: 'This is Mock' })
    })
})
