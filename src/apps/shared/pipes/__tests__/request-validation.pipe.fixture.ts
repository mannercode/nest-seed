import { Body, Controller, ParseArrayPipe, Post } from '@nestjs/common'
import { APP_PIPE } from '@nestjs/core'
import { Type } from 'class-transformer'
import { IsDate, IsNotEmpty, IsString } from 'class-validator'
import { createHttpTestContext, HttpTestContext } from 'testlib'
import { RequestValidationPipe } from '..'

class SampleDto {
    @IsString()
    @IsNotEmpty()
    sampleId: string

    @IsDate()
    @Type(() => Date)
    date: Date
}

@Controller()
class SamplesController {
    @Post()
    async handleQuery(@Body() body: SampleDto) {
        return body
    }

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
}

export const createFixture = async () => {
    const testContext = await createHttpTestContext({
        metadata: {
            controllers: [SamplesController],
            providers: [{ provide: APP_PIPE, useClass: RequestValidationPipe }]
        }
    })

    const teardown = async () => {
        await testContext?.close()
    }

    return { ...testContext, teardown }
}

export interface Fixture extends HttpTestContext {
    teardown: () => Promise<void>
}
