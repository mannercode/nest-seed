import type { Fixture } from './client-proxy-with-name.fixture'

describe('ClientProxyService with name', () => {
    let fixture: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./client-proxy-with-name.fixture')
        fixture = await createFixture()
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
