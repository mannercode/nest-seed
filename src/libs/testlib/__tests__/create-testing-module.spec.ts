import { TestingModule } from '@nestjs/testing'
import { createTestingModule } from '..'
import { SampleModule, SampleService } from './create-testing-module.fixture'

describe('createTestingModule', () => {
    let module: TestingModule

    beforeEach(async () => {
        module = await createTestingModule({
            imports: [SampleModule],
            overrideProviders: [
                {
                    original: SampleService,
                    replacement: {
                        getMessage: jest.fn().mockReturnValue({ message: 'This is Mock' })
                    }
                }
            ]
        })
    })

    afterEach(async () => {
        await module?.close()
    })

    it('overrideProviders에 설정한 mock 서비스가 응답해야 한다', async () => {
        const service = module.get(SampleService)
        const message = await service.getMessage('value')

        expect(message).toEqual({ message: 'This is Mock' })
    })
})
