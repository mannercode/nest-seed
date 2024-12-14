import { AppModule } from 'app/app.module'
import { configureApp } from 'app/main'
import { createHttpTestContext, HttpTestClient, HttpTestContext } from 'testlib'

describe('/health', () => {
    let testContext: HttpTestContext
    let client: HttpTestClient

    beforeEach(async () => {
        testContext = await createHttpTestContext({ imports: [AppModule] }, configureApp)
        client = testContext.client
    })

    afterEach(async () => {
        await testContext.close()
    })

    it('health 체크를 해야 한다', async () => {
        await client.get('/health').ok()
    })
})
