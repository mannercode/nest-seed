import {
    type TestModuleOptions,
    type TestContext,
    createTestContext
} from './create-test-context.js'
import { HttpTestClient } from './http.test-client.js'

export type HttpTestContext = TestContext & { httpClient: HttpTestClient }

export async function createHttpTestContext(metadata: TestModuleOptions): Promise<HttpTestContext> {
    const ctx = await createTestContext(metadata)

    await using setup = new AsyncDisposableStack()
    setup.defer(ctx.close)
    await ctx.app.listen(0, '127.0.0.1')
    const httpClient = new HttpTestClient(await ctx.app.getUrl())
    setup.move()
    return { httpClient, ...ctx }
}
