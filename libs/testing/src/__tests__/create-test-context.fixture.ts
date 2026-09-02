import { Controller, Get, Injectable, Param } from '@nestjs/common'
import { createHttpTestContext, HttpTestClient } from '../index.js'

export type TestContextFixture = {
    httpClient: HttpTestClient
    sampleService: SampleService
    teardown: () => Promise<void>
}

@Injectable()
export class SampleService {
    getMessage() {
        return 'This method should not be called'
    }
}

@Controller()
class SampleController {
    @Get('message/:arg')
    async getHttpMessage(@Param('arg') arg: string) {
        return { received: arg }
    }
}

export async function createTestContextFixture(): Promise<TestContextFixture> {
    const { httpClient, ...ctx } = await createHttpTestContext({
        controllers: [SampleController],
        overrideProviders: [
            {
                original: SampleService,
                replacement: { getMessage: vi.fn().mockReturnValue({ message: 'This is Mock' }) }
            }
        ],
        providers: [SampleService]
    })

    const sampleService = ctx.module.get(SampleService)

    const teardown = async () => {
        await ctx.close()
    }

    return { httpClient, sampleService, teardown }
}
