import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    MessageEvent,
    OnModuleDestroy,
    Post,
    Query,
    Sse
} from '@nestjs/common'
import { EventPattern } from '@nestjs/microservices'
import { BulkCreateShowtimesDto, ShowtimeCreationClient } from 'apps/applications'
import { PaginationDto } from 'common'
import { Observable, Subject } from 'rxjs'
import { Events } from 'shared'

@Controller('showtime-creation')
export class ShowtimeCreationController implements OnModuleDestroy {
    private eventStream = new Subject<MessageEvent>()

    constructor(private readonly showtimeCreationClient: ShowtimeCreationClient) {}

    onModuleDestroy() {
        this.eventStream.complete()
    }

    @Get('theaters')
    async searchTheatersPage(@Query() searchDto: PaginationDto) {
        return this.showtimeCreationClient.searchTheatersPage(searchDto)
    }

    @Get('movies')
    async searchMoviesPage(@Query() searchDto: PaginationDto) {
        return this.showtimeCreationClient.searchMoviesPage(searchDto)
    }

    @HttpCode(HttpStatus.OK)
    @Post('showtimes\\:search')
    async searchShowtimesByTheaterIds(@Body('theaterIds') theaterIds: string[]) {
        return this.showtimeCreationClient.searchShowtimes(theaterIds)
    }

    @HttpCode(HttpStatus.ACCEPTED)
    @Post('showtimes')
    async requestShowtimeCreation(@Body() createDto: BulkCreateShowtimesDto) {
        return this.showtimeCreationClient.requestShowtimeCreation(createDto)
    }

    @Sse('event-stream')
    getEventStream(): Observable<MessageEvent> {
        return this.eventStream.asObservable()
    }

    @EventPattern(Events.ShowtimeCreation.statusChanged, {
        // It broadcasts events to all instances.
        // 모든 인스턴스에 이벤트를 브로드캐스팅한다.
        queue: false
    })
    handleEvent(data: any) {
        this.eventStream.next({ data })
    }
}
