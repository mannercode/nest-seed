import { PaginationDto } from '@mannercode/common'
import {
    MessageEvent,
    OnModuleDestroy,
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Post,
    Query,
    Sse
} from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import {
    BulkCreateShowtimesDto,
    ShowtimeCreationService,
    ShowtimeCreationEvent
} from 'applications'
import { Observable, Subject } from 'rxjs'

@Controller('showtime-creation')
export class ShowtimeCreationHttpController implements OnModuleDestroy {
    private eventStream = new Subject<MessageEvent>()

    constructor(private readonly showtimeCreationService: ShowtimeCreationService) {}

    @Sse('event-stream')
    getEventStream(): Observable<MessageEvent> {
        return this.eventStream.asObservable()
    }

    @OnEvent('showtime-creation.statusChanged')
    handleEvent(data: ShowtimeCreationEvent) {
        this.eventStream.next({ data })
    }

    onModuleDestroy() {
        this.eventStream.complete()
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
