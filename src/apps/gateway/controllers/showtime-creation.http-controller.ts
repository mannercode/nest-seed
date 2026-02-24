import { MessageEvent, OnModuleDestroy } from '@nestjs/common'
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Sse } from '@nestjs/common'
import { EventPattern } from '@nestjs/microservices'
import {
    BulkCreateShowtimesDto,
    ShowtimeCreationClient,
    ShowtimeCreationEvent
} from 'apps/applications'
import { PaginationDto } from 'common'
import { Observable } from 'rxjs'
import { Subject } from 'rxjs'
import { Events } from 'shared'

@Controller('showtime-creation')
export class ShowtimeCreationHttpController implements OnModuleDestroy {
    private eventStream = new Subject<MessageEvent>()

    constructor(private readonly showtimeCreationClient: ShowtimeCreationClient) {}

    @Sse('event-stream')
    getEventStream(): Observable<MessageEvent> {
        return this.eventStream.asObservable()
    }

    @EventPattern(Events.ShowtimeCreation.statusChanged, {
        // It broadcasts events to all instances.
        // 모든 인스턴스에 이벤트를 브로드캐스팅한다.
        queue: false
    })
    handleEvent(data: ShowtimeCreationEvent) {
        this.eventStream.next({ data })
    }

    onModuleDestroy() {
        this.eventStream.complete()
    }

    @HttpCode(HttpStatus.ACCEPTED)
    @Post('showtimes')
    async requestShowtimeCreation(@Body() createDto: BulkCreateShowtimesDto) {
        return this.showtimeCreationClient.requestShowtimeCreation(createDto)
    }

    @Get('movies')
    async searchMoviesPage(@Query() searchDto: PaginationDto) {
        return this.showtimeCreationClient.searchMoviesPage(searchDto)
    }

    @HttpCode(HttpStatus.OK)
    @Post('showtimes/search')
    async searchShowtimesByTheaterIds(@Body('theaterIds') theaterIds: string[]) {
        return this.showtimeCreationClient.searchShowtimes(theaterIds)
    }

    @Get('theaters')
    async searchTheatersPage(@Query() searchDto: PaginationDto) {
        return this.showtimeCreationClient.searchTheatersPage(searchDto)
    }
}
