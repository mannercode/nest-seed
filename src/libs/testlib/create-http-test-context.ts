import type { ModuleMetadataEx, TestContext } from './create-test-context'
import { createTestContext } from './create-test-context'
import { HttpTestClient } from './http.test-client'

export type HttpTestContext = TestContext & { httpClient: HttpTestClient }

export async function createHttpTestContext(metadata: ModuleMetadataEx): Promise<HttpTestContext> {
    const ctx = await createTestContext(metadata)

    await ctx.app.listen(0, '127.0.0.1')

    const httpClient = new HttpTestClient(await ctx.app.getUrl())
    return { httpClient, ...ctx }
}
