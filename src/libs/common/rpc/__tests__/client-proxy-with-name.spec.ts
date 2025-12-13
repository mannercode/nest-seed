import type { ClientProxyWithNameFixture } from './client-proxy-with-name.fixture'

describe('ClientProxyService with name', () => {
    let fix: ClientProxyWithNameFixture

    beforeEach(async () => {
        const { createClientProxyWithNameFixture } =
            await import('./client-proxy-with-name.fixture')
        fix = await createClientProxyWithNameFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('when a name is provided', () => {
        it('creates and uses the named ClientProxyService', async () => {
            await fix.httpClient.get('/value').ok({ result: 'success' })
        })
    })
})
