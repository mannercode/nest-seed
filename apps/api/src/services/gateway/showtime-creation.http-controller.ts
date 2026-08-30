import { JsonUtil, PaginationSchema, type PaginationDto } from '@mannercode/common'
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
import { map, Observable } from 'rxjs'
import {
    BulkCreateShowtimesSchema,
    SearchShowtimesByTheatersBodySchema,
    ShowtimeCreationEvents,
    ShowtimeCreationService,
    type BulkCreateShowtimesDto,
    type SearchShowtimesByTheatersBodyDto
} from '#application'
import type { AdminAuthRequest } from './types.js'
import { AdminAuthGuard } from './guards/index.js'
import { IdempotencyKey } from './idempotency-key.decorator.js'
import { ParseIdempotencyKeyPipe } from './pipes/index.js'

@Controller('showtime-creation')
@UseGuards(AdminAuthGuard)
export class ShowtimeCreationHttpController {
    constructor(
        private readonly showtimeCreationService: ShowtimeCreationService,
        private readonly events: ShowtimeCreationEvents
    ) {}

    @Sse('event-stream')
    getEventStream(): Observable<MessageEvent> {
        return this.events
            .observeStatusChanged()
            .pipe(map((data) => ({ data: JsonUtil.stringify(data) })))
    }

    @HttpCode(HttpStatus.ACCEPTED)
    @Post('showtimes')
    async requestShowtimeCreation(
        @Body({ schema: BulkCreateShowtimesSchema }) createDto: BulkCreateShowtimesDto,
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
    async searchMoviesPage(@Query({ schema: PaginationSchema }) searchDto: PaginationDto) {
        return this.showtimeCreationService.searchMoviesPage(searchDto)
    }

    @HttpCode(HttpStatus.OK)
    @Post('showtimes/search')
    async searchShowtimesByTheaterIds(
        @Body({ schema: SearchShowtimesByTheatersBodySchema })
        body: SearchShowtimesByTheatersBodyDto
    ) {
        return this.showtimeCreationService.searchShowtimes(body.theaterIds)
    }

    @Get('theaters')
    async searchTheatersPage(@Query({ schema: PaginationSchema }) searchDto: PaginationDto) {
        return this.showtimeCreationService.searchTheatersPage(searchDto)
    }
}
