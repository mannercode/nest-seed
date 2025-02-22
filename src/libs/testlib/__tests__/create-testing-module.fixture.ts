import { Injectable, Module } from '@nestjs/common'
import { createTestingModule } from '../create-testing-module'

@Injectable()
export class SampleService {
    constructor() {}

    async getMessage() {
        return 'This method should not be called'
    }
}

@Module({ providers: [SampleService] })
class SampleModule {}

export async function createFixture() {
    const module = await createTestingModule({
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

    const sampleService = module.get(SampleService)

    const closeFixture = async () => {
        await module?.close()
    }

    return { closeFixture, module, sampleService }
}
