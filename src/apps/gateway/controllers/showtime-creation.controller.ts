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
    Sse,
    UsePipes
} from '@nestjs/common'
import { EventPattern } from '@nestjs/microservices'
import { ShowtimeBatchCreateDto, ShowtimeCreationProxy } from 'applications'
import { PaginationOptionDto } from 'common'
import { Observable, Subject } from 'rxjs'
import { Events } from 'shared/config'
import { DefaultPaginationPipe } from './pipes'

@Controller('showtime-creation')
export class ShowtimeCreationController implements OnModuleDestroy {
    private sseEventSubject = new Subject<MessageEvent>()

    constructor(private service: ShowtimeCreationProxy) {}

    onModuleDestroy() {
        this.sseEventSubject.complete()
    }

    @UsePipes(DefaultPaginationPipe)
    @Get('theaters')
    async findTheaters(@Query() queryDto: PaginationOptionDto) {
        return this.service.findTheaters(queryDto)
    }

    @UsePipes(DefaultPaginationPipe)
    @Get('movies')
    async findMovies(@Query() queryDto: PaginationOptionDto) {
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
        return this.sseEventSubject.asObservable()
    }

    @EventPattern(Events.ShowtimeCreation.statusChanged, {
        queue: false // 모든 인스턴스에 이벤트 브로드캐스팅 설정
    })
    handleEvent(data: any) {
        this.sseEventSubject.next({ data })
    }
}
