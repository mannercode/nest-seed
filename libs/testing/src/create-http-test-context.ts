import {
    type ModuleMetadataEx,
    type TestContext,
    createTestContext
} from './create-test-context.js'
import { HttpTestClient } from './http.test-client.js'

export type HttpTestContext = TestContext & { httpClient: HttpTestClient }

export async function createHttpTestContext(metadata: ModuleMetadataEx): Promise<HttpTestContext> {
    const ctx = await createTestContext(metadata)

    try {
        await ctx.app.listen(0, '127.0.0.1')

        const httpClient = new HttpTestClient(await ctx.app.getUrl())
        return { httpClient, ...ctx }
    } catch (setupError) {
        try {
            await ctx.close()
        } catch {
            // 설정 오류가 정리 오류에 가려지지 않게 원래 오류를 유지한다.
        }

        throw setupError
    }
}
