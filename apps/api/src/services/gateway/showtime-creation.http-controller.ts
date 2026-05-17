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
    Sse,
    UseGuards
} from '@nestjs/common'
import {
    BulkCreateShowtimesDto,
    SearchShowtimesByTheatersBodyDto,
    ShowtimeCreationEvents,
    ShowtimeCreationService
} from 'application'
import { map, Observable } from 'rxjs'
import { AdminAuthGuard } from './guards'

// 인가: 상영 등록 흐름은 콘솔 운영자(admin) 전용이다. 조회/SSE까지 같은
// 신뢰 영역으로 묶어 클래스 레벨로 가드를 건다.
@Controller('showtime-creation')
@UseGuards(AdminAuthGuard)
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
