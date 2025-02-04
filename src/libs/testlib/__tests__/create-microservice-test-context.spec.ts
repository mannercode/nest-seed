import { MicroserviceTestClient } from '..'
import {
    MicroserviceTestContext,
    createMicroserviceTestContext
} from '../create-microservice-test-context'
import { RequestDto, SampleModule } from './create-microservice-test-context.fixture'

describe('createMicroserviceTestContext', () => {
    let testContext: MicroserviceTestContext
    let client: MicroserviceTestClient

    beforeEach(async () => {
        testContext = await createMicroserviceTestContext({ imports: [SampleModule] })
        client = testContext.client
    })

    afterEach(async () => {
        await testContext?.close()
    })

    it('메시지를 전송하면 응답해야 한다', async () => {
        const dto = new RequestDto()
        dto.arg = 'value'

        const message = await client.send('test.testlib.getMessage', dto)

        expect(message).toEqual({ id: dto.arg })
    })
})
