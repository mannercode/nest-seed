import { SampleService } from './create-testing-module.fixture'

describe('createTestingModule', () => {
    let closeFixture: () => void
    let sampleService: SampleService

    beforeEach(async () => {
        const { createFixture } = await import('./create-testing-module.fixture')

        const fixture = await createFixture()
        closeFixture = fixture.closeFixture
        sampleService = fixture.sampleService
    })

    afterEach(async () => {
        await closeFixture?.()
    })

    it('overrideProviders에 설정한 mock 서비스가 응답해야 한다', async () => {
        const message = await sampleService.getMessage()

        expect(message).toEqual({ message: 'This is Mock' })
    })
})
