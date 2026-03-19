import { HttpTestContext } from '@mannercode/nest-testing'
import { createHttpTestContext } from '@mannercode/nest-testing'
import { Body, Controller, ParseArrayPipe, Post } from '@nestjs/common'
import { APP_PIPE } from '@nestjs/core'
import { Type } from 'class-transformer'
import { IsDate, IsNotEmpty, IsString } from 'class-validator'
import { RequestValidationPipe } from '..'

export type RequestValidationPipeFixture = HttpTestContext & { teardown: () => Promise<void> }

class SampleDto {
    @IsDate()
    @Type(() => Date)
    date: Date

    @IsNotEmpty()
    @IsString()
    sampleId: string
}

@Controller()
class SamplesController {
    @Post('array')
    async handleArray(@Body(new ParseArrayPipe({ items: SampleDto })) body: SampleDto[]) {
        return body
    }

    @Post('nested')
    async handleNestedArray(
        @Body('samples', new ParseArrayPipe({ items: SampleDto })) samples: SampleDto[]
    ) {
        return samples
    }

    @Post()
    async handleQuery(@Body() body: SampleDto) {
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
