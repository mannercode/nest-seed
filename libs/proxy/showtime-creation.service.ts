import { Injectable } from '@nestjs/common'
import { MethodLog, PaginationOption } from 'common'
import { EMPTY, Observable } from 'rxjs'
import {
    MovieDto,
    ShowtimeBatchCreateDto,
    ShowtimeBatchCreateResponse,
    ShowtimeDto,
    TheaterDto
} from 'types'

@Injectable()
export class ShowtimeCreationService {
    constructor() {}

    @MethodLog({ level: 'verbose' })
    async findMovies(queryDto: PaginationOption): Promise<MovieDto[]> {
        return []
    }

    @MethodLog({ level: 'verbose' })
    async findTheaters(queryDto: PaginationOption): Promise<TheaterDto[]> {
        return []
    }

    @MethodLog({ level: 'verbose' })
    async findShowtimes(theaterIds: string[]): Promise<ShowtimeDto[]> {
        return []
    }

    @MethodLog()
    async createBatchShowtimes(
        createDto: ShowtimeBatchCreateDto
    ): Promise<ShowtimeBatchCreateResponse> {
        return { batchId: '' }
    }

    @MethodLog()
    monitorEvents(): Observable<MessageEvent> {
        return EMPTY
    }
}
