import {
    MicroserviceTestClient,
    MicroserviceTestContext,
    createMicroserviceTestContext,
    createNatsContainers
} from '..'
import { SampleModule } from './create-microservice-test-context.fixture'

describe('createMicroserviceTestContext', () => {
    let testContext: MicroserviceTestContext
    let client: MicroserviceTestClient
    let closeNats: () => Promise<void>

    beforeEach(async () => {
        const { servers, close } = await createNatsContainers()
        closeNats = close
        testContext = await createMicroserviceTestContext({
            metadata: { imports: [SampleModule] },
            nats: { servers }
        })
        client = testContext.client
    })

    afterEach(async () => {
        await testContext?.close()
        await closeNats?.()
    })

    it('메시지를 전송하면 응답해야 한다', async () => {
        const message = await client.send('test.getMessage', { arg: 'value' })

        expect(message).toEqual({ id: 'value' })
    })
})
