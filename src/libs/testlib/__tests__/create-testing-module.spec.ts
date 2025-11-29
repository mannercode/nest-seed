import type { Fixture } from './create-testing-module.fixture'

describe('createTestingModule', () => {
    let fixture: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./create-testing-module.fixture')
        fixture = await createFixture()
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
