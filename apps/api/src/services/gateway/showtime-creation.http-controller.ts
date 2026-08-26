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
    Req,
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
import type { AdminAuthRequest } from './types'
import { AdminAuthGuard } from './guards'
import { IdempotencyKey } from './idempotency-key.decorator'
import { ParseIdempotencyKeyPipe } from './pipes'

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
    async requestShowtimeCreation(
        @Body() createDto: BulkCreateShowtimesDto,
        @IdempotencyKey(ParseIdempotencyKeyPipe) idempotencyKey: string,
        @Req() req: AdminAuthRequest
    ) {
        return this.showtimeCreationService.requestShowtimeCreation(
            createDto,
            req.user.sub,
            idempotencyKey
        )
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
