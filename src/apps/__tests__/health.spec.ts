import { HttpTestClient } from 'testlib'
import { createTestContext, TestContext } from './test.util'

describe('/health', () => {
    let testContext: TestContext
    let client: HttpTestClient

    beforeEach(async () => {
        testContext = await createTestContext()
        client = testContext.client
    })

    afterEach(async () => {
        await testContext.close()
    })

    it('health 체크를 해야 한다', async () => {
        await client.get('/health').ok()
    })
})
