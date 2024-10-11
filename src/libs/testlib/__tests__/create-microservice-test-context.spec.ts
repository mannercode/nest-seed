import { MicroserviceTestClient } from '..'
import {
    MicroserviceTestContext,
    createMicroserviceTestContext
} from '../create-microservice-test-context'
import { SampleModule, SampleService } from './create-microservice-test-context.fixture'

describe('createHttpTestContext', () => {
    let testContext: MicroserviceTestContext
    let client: MicroserviceTestClient

    beforeEach(async () => {
        testContext = await createMicroserviceTestContext({
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
        const message = await client.send('getMessage', 'args')

        expect(message).toEqual({ message: 'This is Mock' })
    })
})
