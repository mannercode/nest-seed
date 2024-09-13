import { UsePipes, Controller, Get, Module, Query } from '@nestjs/common'
import { IsNotEmpty } from 'class-validator'
import { PaginationOption, PaginationPipe } from '../pagination'

export class UserQuery {
    @IsNotEmpty()
    name: string
}

@Controller('samples')
class SamplesController {
    @Get()
    async handleQuery(@Query() query: PaginationOption) {
        return query
    }

    @Get('multiple')
    @UsePipes(new PaginationPipe(50))
    async handleMultiple(@Query() pagination: PaginationOption, @Query() user: UserQuery) {
        return { pagination, user }
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
