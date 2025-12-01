import type { TestingModuleFixture } from './create-testing-module.fixture'

describe('createTestingModule', () => {
    let fixture: TestingModuleFixture

    beforeEach(async () => {
        const { createTestingModuleFixture } = await import('./create-testing-module.fixture')
        fixture = await createTestingModuleFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('when a service is mocked via overrideProviders', () => {
        it('uses the mocked service', async () => {
            const message = fixture.sampleService.getMessage()
            expect(message).toEqual({ message: 'This is Mock' })
        })
    })
})
