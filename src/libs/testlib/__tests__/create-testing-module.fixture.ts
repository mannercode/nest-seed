import { Injectable } from '@nestjs/common'
import { createTestingModule } from 'testlib'

@Injectable()
export class SampleService {
    getMessage() {
        return 'This method should not be called'
    }
}

export type Fixture = { teardown: () => Promise<void>; sampleService: SampleService }

export async function createFixture(): Promise<Fixture> {
    const module = await createTestingModule({
        providers: [SampleService],
        overrideProviders: [
            {
                original: SampleService,
                replacement: { getMessage: jest.fn().mockReturnValue({ message: 'This is Mock' }) }
            }
        ]
    })

    const sampleService = module.get(SampleService)

    async function teardown() {
        await module.close()
    }

    return { teardown, sampleService }
}
