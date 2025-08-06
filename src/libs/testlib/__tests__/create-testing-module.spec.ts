import type { Fixture } from './create-testing-module.fixture'

describe('createTestingModule', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./create-testing-module.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    // overrideProviders를 통해 서비스를 모의(mock) 처리했을 때
    describe('when a service is mocked via overrideProviders', () => {
        // 모의 처리된 서비스를 사용한다.
        it('uses the mocked service', async () => {
            const message = fix.sampleService.getMessage()
            expect(message).toEqual({ message: 'This is Mock' })
        })
    })
})
