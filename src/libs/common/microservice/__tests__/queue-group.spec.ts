import { HttpTestClient, TestContext } from 'testlib'

describe('ClientProxyService', () => {
    let testContext: TestContext
    let client: HttpTestClient

    beforeEach(async () => {
        const { createFixture } = await import('./queue-group.fixture')
        const fixture = await createFixture()

        testContext = fixture.testContext
        client = fixture.client
    })

    afterEach(async () => {
        await testContext?.close()
    })

    it.skip('메시지는 queue 그룹 마다 한 번만 전달되어야 한다', async () => {})
    it.skip('이벤트는 queue 그룹과 상관없이 모든 인스턴스에 전달되어야 한다', async () => {})
})
