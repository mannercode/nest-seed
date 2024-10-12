import { UsePipes, Controller, Get, Module, Query } from '@nestjs/common'
import { IsNotEmpty } from 'class-validator'
import { PaginationOption, PaginationPipe } from '../pagination'

@Controller('samples')
class SamplesController {
    @Get()
    async handleQuery(@Query() query: PaginationOption) {
        return query
    }

    @Get('takeLimit')
    @UsePipes(new PaginationPipe(50))
    async handleMaxsize(@Query() pagination: PaginationOption) {
        return pagination
    }
}

@Module({
    controllers: [SamplesController]
})
export class SamplesModule {}
