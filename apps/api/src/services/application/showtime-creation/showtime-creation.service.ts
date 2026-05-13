import { PaginationDto, OrderDirection } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { MoviesService, ShowtimesService, TheatersService } from 'core'
import { BulkCreateShowtimesDto, RequestShowtimeCreationResponse } from './dtos'
import { ShowtimeCreationOrchestratorService } from './internal'

@Injectable()
export class ShowtimeCreationService {
    constructor(
        private readonly theatersService: TheatersService,
        private readonly moviesService: MoviesService,
        private readonly showtimesService: ShowtimesService,
        private readonly orchestrator: ShowtimeCreationOrchestratorService
    ) {}

    async requestShowtimeCreation(
        createDto: BulkCreateShowtimesDto
    ): Promise<RequestShowtimeCreationResponse> {
        const sagaId = await this.orchestrator.enqueueShowtimeCreationJob(createDto)

        return { sagaId }
    }

    async searchMoviesPage(searchDto: PaginationDto) {
        // 호출자가 정렬을 지정했으면 그대로 사용한다. 지정하지 않은 경우에만
        // 이 화면의 기본값(개봉일 내림차순)을 채운다.
        const orderby = searchDto.orderby ?? { direction: OrderDirection.Desc, name: 'releaseDate' }

        return this.moviesService.searchPage({ ...searchDto, orderby })
    }

    async searchShowtimes(theaterIds: string[]) {
        return this.showtimesService.search({ endTimeRange: { start: new Date() }, theaterIds })
    }

    async searchTheatersPage(searchDto: PaginationDto) {
        return this.theatersService.searchPage(searchDto)
    }
}
