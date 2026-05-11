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

// 인가: 이 컨트롤러도 인가 검사를 비워 둔다. SSE 스트림은 다른 사용자가
// 만든 saga 의 진행 상황까지 그대로 보여 주므로 특히 주의한다. 포크할 때는
// `@UseGuards(UserJwtAuthGuard)` 또는 관리자 가드를 도메인 정책에 맞게
// 붙인다. 자세한 안내는 README "5. 인가" 절에 있다.
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
