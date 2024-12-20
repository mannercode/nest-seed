import { Body, Controller, Module, ParseArrayPipe, Post } from '@nestjs/common'
import { Type } from 'class-transformer'
import { IsDate, IsNotEmpty, IsString } from 'class-validator'

export class SampleDto {
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
export class SamplesModule {}
