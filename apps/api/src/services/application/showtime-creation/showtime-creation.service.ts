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
        // caller 가 명시한 orderby 가 있으면 그대로 따른다 (그동안 묵시적 덮어쓰기로
        // caller 가 보낸 정렬이 사라지던 동작을 바로잡음). 명시 안 한 경우만 이 화면의
        // 기본 정렬인 'releaseDate desc' 를 채워 준다.
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
