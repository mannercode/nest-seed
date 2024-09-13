import { MicroserviceTestClient } from '..'
import {
    MicroserviceTestContext,
    createMicroserviceTestContext
} from '../create-microservice-test-context'
import { SampleModule, SampleService } from './create-microservice-test-context.fixture'

describe('createHttpTestContext', () => {
    let testContext: MicroserviceTestContext
    let client: MicroserviceTestClient

    const serviceMock = {
        getMessage: jest.fn().mockReturnValue({ message: 'This is Mock' })
    }

    beforeEach(async () => {
        testContext = await createMicroserviceTestContext({
            imports: [SampleModule],
            overrideProviders: [
                {
                    original: SampleService,
                    replacement: serviceMock
                }
            ]
        })
        client = testContext.client
    })

    afterEach(async () => {
        await testContext?.close()
    })

    it('should return mock message', async () => {
        const message = await client.send('getMessage', 'args')

        expect(message).toEqual({ message: 'This is Mock' })
    })
})
