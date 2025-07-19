import type { Fixture } from './create-testing-module.fixture'

describe('createTestingModule()', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./create-testing-module.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    // 상황: overrideProviders를 통해 서비스를 모의(mock) 처리했을 때
    describe('when a service is mocked via overrideProviders', () => {
        // 기대 결과: 원본 서비스 대신 모의 처리된 서비스가 사용된다.
        it('uses the mocked service instead of the original', async () => {
            const message = fix.sampleService.getMessage()
            expect(message).toEqual({ message: 'This is Mock' })
        })
    })
})
