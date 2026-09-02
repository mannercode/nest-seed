import { createHttpTestContext, type HttpTestContext } from '@mannercode/testing'
import { Body, Controller, Post } from '@nestjs/common'
import { APP_PIPE } from '@nestjs/core'
import { z } from 'zod'
import { RequestValidationPipe } from '../index.js'

export type RequestValidationPipeFixture = HttpTestContext & { teardown: () => Promise<void> }

const SampleSchema = z.strictObject({
    date: z.union([z.date(), z.string(), z.number(), z.boolean()]).pipe(z.coerce.date()),
    sampleId: z
        .union([z.string(), z.number(), z.boolean()])
        .transform(String)
        .pipe(z.string().min(1))
})
type SampleDto = z.infer<typeof SampleSchema>

@Controller()
class SamplesController {
    @Post('array')
    async handleArray(@Body({ schema: z.array(SampleSchema) }) body: SampleDto[]) {
        return body
    }

    @Post('nested')
    async handleNestedArray(
        @Body('samples', { schema: z.array(SampleSchema) }) samples: SampleDto[]
    ) {
        return samples
    }

    @Post()
    async handleQuery(@Body({ schema: SampleSchema }) body: SampleDto) {
        return body
    }
}

export async function createRequestValidationPipeFixture() {
    const ctx = await createHttpTestContext({
        controllers: [SamplesController],
        providers: [{ provide: APP_PIPE, useClass: RequestValidationPipe }]
    })

    const teardown = async () => {
        await ctx.close()
    }

    return { ...ctx, teardown }
}
