import { AddressInfo } from 'net'
import { createTestContext, ModuleMetadataEx, TestContext } from './create-test-context'
import { HttpTestClient } from './http.test-client'

export type HttpTestContext = TestContext & { httpClient: HttpTestClient }

export async function createHttpTestContext(metadata: ModuleMetadataEx): Promise<HttpTestContext> {
    const ctx = await createTestContext(metadata)

    const httpServer = ctx.app.getHttpServer()
    await httpServer.listen(0)
    const address = httpServer.address()
    const { port } = address as AddressInfo

    const httpClient = new HttpTestClient(`http://localhost:${port}`)
    return { httpClient, ...ctx }
}
