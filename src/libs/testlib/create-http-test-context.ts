import { Server } from 'http'
import { HttpTestClient } from './http.test-client'
import { getAvailablePort } from './utils'
import { createTestContext, TestContext, ModuleMetadataEx } from './create-test-context'

async function listenOnAvailablePort(server: Server): Promise<number> {
    const maxAttempts = 3
    let attemptCount = 0

    while (true) {
        try {
            const port = await getAvailablePort()
            await server.listen(port)
            return port
        } catch (error) {
            attemptCount++
            if (attemptCount >= maxAttempts) throw error
        }
    }
}

export type HttpTestContext = TestContext & { httpClient: HttpTestClient }

export async function createHttpTestContext(metadata: ModuleMetadataEx): Promise<HttpTestContext> {
    const testContext = await createTestContext(metadata)

    const httpServer = testContext.app.getHttpServer()
    const httpPort = await listenOnAvailablePort(httpServer)
    const httpClient = new HttpTestClient(httpPort)

    return { ...testContext, httpClient }
}
