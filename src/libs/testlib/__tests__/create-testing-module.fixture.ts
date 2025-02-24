import { Injectable } from '@nestjs/common'
import { createTestingModule } from '../create-testing-module'

@Injectable()
export class SampleService {
    constructor() {}

    async getMessage() {
        return 'This method should not be called'
    }
}

export async function createFixture() {
    const module = await createTestingModule({
        providers: [SampleService],
        overrideProviders: [
            {
                original: SampleService,
                replacement: {
                    getMessage: jest.fn().mockReturnValue({ message: 'This is Mock' })
                }
            }
        ]
    })

    const sampleService = module.get(SampleService)

    const closeFixture = async () => {
        await module?.close()
    }

    return { closeFixture, module, sampleService }
}
