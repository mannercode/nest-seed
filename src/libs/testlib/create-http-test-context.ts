import { AddressInfo } from 'net'
import { createTestContext, ModuleMetadataEx, TestContext } from './create-test-context'
import { HttpTestClient } from './http.test-client'

export type HttpTestContext = TestContext & { httpClient: HttpTestClient }

export async function createHttpTestContext(metadata: ModuleMetadataEx): Promise<HttpTestContext> {
    const ctx = await createTestContext(metadata)

    const httpServer = ctx.app.getHttpServer()
    await new Promise<void>((resolve, reject) => {
        httpServer.once('error', reject)
        httpServer.listen(0, resolve)
    })
    const address = httpServer.address()
    if (!address || typeof address === 'string') {
        throw new Error('Failed to bind HTTP server to a port')
    }
    const { port } = address as AddressInfo

    const httpClient = new HttpTestClient(`http://localhost:${port}`)
    return { httpClient, ...ctx }
}
