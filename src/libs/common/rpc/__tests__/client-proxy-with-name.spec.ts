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

    // name을 지정하는 경우
    describe('when a name is provided', () => {
        // ClientProxyService를 생성하고 호출할 수 있다
        it('creates and uses the named ClientProxyService', async () => {
            await fixture.httpClient.get('/value').ok({ result: 'success' })
        })
    })
})
