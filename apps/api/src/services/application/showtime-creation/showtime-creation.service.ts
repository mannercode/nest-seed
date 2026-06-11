import { PaginationDto, OrderDirection } from '@mannercode/common'
import { BadRequestException, Injectable } from '@nestjs/common'
import { MoviesService, ShowtimesService, TheatersService } from 'core'
import { BulkCreateShowtimesDto, RequestShowtimeCreationResponse } from './dtos'
import { ShowtimeCreationErrors } from './errors'
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
        this.assertStartTimesDoNotOverlap(createDto)

        const sagaId = await this.orchestrator.enqueueShowtimeCreationJob(createDto)

        return { sagaId }
    }

    // 검증 액티비티는 기존 상영과의 충돌만 보므로, 요청 안에서 서로 겹치는 시작 시각은
    // 사가를 시작하기 전에 입력 오류로 거절한다.
    // 같은 상영 길이가 모든 극장에 적용되므로, 시작 시각 간격이 상영 길이보다 짧으면(중복 포함) 반드시 겹친다.
    private assertStartTimesDoNotOverlap({
        durationInMinutes,
        startTimes
    }: BulkCreateShowtimesDto) {
        const sorted = [...startTimes].sort((a, b) => a.getTime() - b.getTime())
        const durationMs = durationInMinutes * 60 * 1000

        const overlapping: Date[] = []
        let prev: Date | undefined
        for (const start of sorted) {
            if (prev && start.getTime() - prev.getTime() < durationMs) {
                overlapping.push(start)
            }
            prev = start
        }

        if (0 < overlapping.length) {
            throw new BadRequestException(ShowtimeCreationErrors.OverlappingStartTimes(overlapping))
        }
    }

    async searchMoviesPage(searchDto: PaginationDto) {
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
