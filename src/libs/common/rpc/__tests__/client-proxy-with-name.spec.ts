import type { Fixture } from './client-proxy-with-name.fixture'

describe('ClientProxyService with name', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./client-proxy-with-name.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    // name을 지정하는 경우
    describe('when a name is provided', () => {
        // ClientProxyService를 생성하고 호출할 수 있다
        it('creates and uses the named ClientProxyService', async () => {
            await fix.httpClient.get('/value').ok({ result: 'success' })
        })
    })
})
