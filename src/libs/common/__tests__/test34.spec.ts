import { withTestId } from 'testlib'
import type { ClientProxyServiceFixture } from './client-proxy.service.fixture'

describe('ClientProxyService', () => {
    let fix: ClientProxyServiceFixture

    beforeEach(async () => {
        const { createClientProxyServiceFixture } = await import('./client-proxy.service.fixture')
        fix = await createClientProxyServiceFixture()
    })
    afterEach(() => fix.teardown())

    it.each([
        ['1024B', 1024],
        ['1KB', 1024],
        ['1MB', 1024 * 1024],
        ['1GB', 1024 * 1024 * 1024],
        ['1TB', 1024 * 1024 * 1024 * 1024],
        ['1KB 512B', 1536],
        ['1.5KB', 1536],
        ['-1KB', -1024],
        ['1GB 256MB 128KB', 1 * 1024 * 1024 * 1024 + 256 * 1024 * 1024 + 128 * 1024]
    ])('converts %s to bytes', async () => {
        const msg = withTestId('method')
        const response = await fix.rpcClient.getJson(msg, null)
        expect(response).toEqual({ result: 'success' })
    })
})
