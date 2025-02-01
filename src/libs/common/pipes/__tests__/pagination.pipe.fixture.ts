import { Controller, Get, Injectable, Module, Query, UsePipes } from '@nestjs/common'
import { PaginationOptionDto, PaginationPipe } from 'common'

@Injectable()
class DefaultPaginationPipe extends PaginationPipe {
    get takeLimit(): number {
        return 50
    }
}

@Controller('samples')
class SamplesController {
    @Get()
    async handleQuery(@Query() query: PaginationOptionDto) {
        return query
    }

    @Get('takeLimit')
    @UsePipes(DefaultPaginationPipe)
    async handleMaxsize(@Query() pagination: PaginationOptionDto) {
        return pagination
    }
}

@Module({
    controllers: [SamplesController]
})
export class SamplesModule {}
