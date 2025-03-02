import { Body, Controller, ParseArrayPipe, Post } from '@nestjs/common'
import { APP_PIPE } from '@nestjs/core'
import { Type } from 'class-transformer'
import { IsDate, IsNotEmpty, IsString } from 'class-validator'
import { AppValidationPipe } from 'common'
import { createHttpTestContext } from 'testlib'

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

export async function createFixture() {
    const testContext = await createHttpTestContext({
        metadata: {
            controllers: [SamplesController],
            providers: [{ provide: APP_PIPE, useClass: AppValidationPipe }]
        }
    })

    const closeFixture = async () => {
        await testContext?.close()
    }

    return { testContext, closeFixture, client: testContext.httpClient }
}
