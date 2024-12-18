import { Body, Controller, Module, Post } from '@nestjs/common'
import { IsNotEmpty, IsString } from 'class-validator'

export class SampleDto {
    @IsString()
    @IsNotEmpty()
    sampleId: string
}

@Controller()
class SamplesController {
    @Post()
    async handleQuery(@Body() body: SampleDto) {
        return body
    }
}

@Module({
    controllers: [SamplesController]
})
export class SamplesModule {}
