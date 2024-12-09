import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    MessageEvent,
    Post,
    Query,
    Sse,
    UsePipes
} from '@nestjs/common'
import { PaginationOption } from 'common'
import { Observable } from 'rxjs'
import { ShowtimeBatchCreateDto, ShowtimeCreationService } from 'services/applications'
import { DefaultPaginationPipe } from './pipes'

@Controller('showtime-creation')
export class ShowtimeCreationController {
    constructor(private service: ShowtimeCreationService) {}

    @UsePipes(DefaultPaginationPipe)
    @Get('theaters')
    async findTheaters(@Query() queryDto: PaginationOption) {
        return this.service.findTheaters(queryDto)
    }

    @UsePipes(DefaultPaginationPipe)
    @Get('movies')
    async findMovies(@Query() queryDto: PaginationOption) {
        return this.service.findMovies(queryDto)
    }

    @HttpCode(HttpStatus.OK)
    @Post('showtimes/find')
    async findShowtimesByTheaterIds(@Body('theaterIds') theaterIds: string[]) {
        return this.service.findShowtimes(theaterIds)
    }

    @HttpCode(HttpStatus.ACCEPTED)
    @Post('showtimes')
    async createBatchShowtimes(@Body() createDto: ShowtimeBatchCreateDto) {
        return this.service.createBatchShowtimes(createDto)
    }

    @Sse('events')
    events(): Observable<MessageEvent> {
        return this.service.monitorEvents()
    }
}
