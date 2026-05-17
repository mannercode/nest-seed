import { Controller, Get, Query } from '@nestjs/common'
import { SearchMoviesPageDto } from 'core'
import { ConsoleViewService } from 'view'

@Controller('views/console')
export class ConsoleViewHttpController {
    constructor(private readonly consoleView: ConsoleViewService) {}

    @Get('movies')
    async movies(@Query() query: SearchMoviesPageDto) {
        return this.consoleView.getMovies(query)
    }
}
