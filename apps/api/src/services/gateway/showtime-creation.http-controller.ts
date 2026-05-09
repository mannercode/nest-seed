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
    SearchShowtimesByTheatersBodyDto,
    ShowtimeCreationEvents,
    ShowtimeCreationService
} from 'application'
import { map, Observable } from 'rxjs'

// AUTHZ: 시드는 인가 검사를 일부러 비워 둔다. 포크 시 도메인 정책에 맞춰
// `@UseGuards(UserJwtAuthGuard)` (또는 admin 가드) 를 추가하라. SSE 스트림은
// 다른 사용자의 saga 진행 상황까지 노출되므로 특히 주의. README "5. 인가" 섹션 참고.
@Controller('showtime-creation')
export class ShowtimeCreationHttpController {
    constructor(
        private readonly showtimeCreationService: ShowtimeCreationService,
        private readonly events: ShowtimeCreationEvents
    ) {}

    @Sse('event-stream')
    getEventStream(): Observable<MessageEvent> {
        return this.events.observeStatusChanged().pipe(map((data) => ({ data })))
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
    async searchShowtimesByTheaterIds(@Body() body: SearchShowtimesByTheatersBodyDto) {
        return this.showtimeCreationService.searchShowtimes(body.theaterIds)
    }

    @Get('theaters')
    async searchTheatersPage(@Query() searchDto: PaginationDto) {
        return this.showtimeCreationService.searchTheatersPage(searchDto)
    }
}
