import { PaginationDto } from '@mannercode/common'
import {
    MessageEvent,
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Post,
    Query,
    Sse
} from '@nestjs/common'
import {
    BulkCreateShowtimesDto,
    ShowtimeCreationEvents,
    ShowtimeCreationService
} from 'applications'
import { interval, map, merge, Observable } from 'rxjs'

@Controller('showtime-creation')
export class ShowtimeCreationHttpController {
    constructor(
        private readonly showtimeCreationService: ShowtimeCreationService,
        private readonly events: ShowtimeCreationEvents
    ) {}

    @Sse('event-stream')
    getEventStream(): Observable<MessageEvent> {
        // 15s keepalive: nginx proxy_read_timeout(60s) 가 idle SSE 를 끊지 않게
        // 한다. payload 는 sagaId 가 없어 모든 컨슈머의 status 매칭에서 무시됨.
        const events$ = this.events.observeStatusChanged().pipe(map((data) => ({ data })))
        const keepalive$ = interval(15_000).pipe(map(() => ({ data: { __keepalive: true } })))
        return merge(events$, keepalive$)
    }

    @HttpCode(HttpStatus.ACCEPTED)
    @Post('showtimes')
    async requestShowtimeCreation(@Body() createDto: BulkCreateShowtimesDto) {
        return this.showtimeCreationService.requestShowtimeCreation(createDto)
    }

    @Get('movies')
    async searchMoviesPage(@Query() searchDto: PaginationDto) {
        return this.showtimeCreationService.searchMoviesPage(searchDto)
    }

    @HttpCode(HttpStatus.OK)
    @Post('showtimes/search')
    async searchShowtimesByTheaterIds(@Body('theaterIds') theaterIds: string[]) {
        return this.showtimeCreationService.searchShowtimes(theaterIds)
    }

    @Get('theaters')
    async searchTheatersPage(@Query() searchDto: PaginationDto) {
        return this.showtimeCreationService.searchTheatersPage(searchDto)
    }
}
