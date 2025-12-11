import type { ClientProxyWithNameFixture } from './client-proxy-with-name.fixture'

describe('ClientProxyService with name', () => {
    let fixture: ClientProxyWithNameFixture

    beforeEach(async () => {
        const { createClientProxyWithNameFixture } =
            await import('./client-proxy-with-name.fixture')
        fixture = await createClientProxyWithNameFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('when a name is provided', () => {
        it('creates and uses the named ClientProxyService', async () => {
            await fixture.httpClient.get('/value').ok({ result: 'success' })
        })
    })
})
