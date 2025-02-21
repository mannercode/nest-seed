import { Body, Controller, Module, ParseArrayPipe, Post } from '@nestjs/common'
import { APP_PIPE } from '@nestjs/core'
import { Type } from 'class-transformer'
import { IsDate, IsNotEmpty, IsString } from 'class-validator'
import { AppValidationPipe } from 'common'
import { createHttpTestContext, HttpTestClient } from 'testlib'

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

@Module({
    controllers: [SamplesController]
})
class SamplesModule {}

export async function createFixture() {
    const testContext = await createHttpTestContext({
        imports: [SamplesModule],
        providers: [{ provide: APP_PIPE, useClass: AppValidationPipe }]
    })
    const client = new HttpTestClient(testContext.httpPort)

    return { testContext, client }
}
