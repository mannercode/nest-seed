import { DateUtil, IdempotencyErrors, PaginationDto, OrderDirection } from '@mannercode/common'
import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException
} from '@nestjs/common'
import { MoviesService, ShowtimesService, TheatersService } from '#core'
import { BulkCreateShowtimesDto, RequestShowtimeCreationResponse } from './dtos/index.js'
import { ShowtimeCreationErrors } from './errors.js'
import {
    ShowtimeCreationOrchestratorService,
    ShowtimeCreationSubmissionRepository
} from './internal/index.js'
import { fingerprintShowtimeCreation } from './internal/showtime-creation-fingerprint.js'

const SUBMISSION_CLAIM_LEASE_MS = 5 * 60 * 1000

@Injectable()
export class ShowtimeCreationService {
    constructor(
        private readonly theatersService: TheatersService,
        private readonly moviesService: MoviesService,
        private readonly showtimesService: ShowtimesService,
        private readonly orchestrator: ShowtimeCreationOrchestratorService,
        private readonly submissions: ShowtimeCreationSubmissionRepository
    ) {}

    async requestShowtimeCreation(
        createDto: BulkCreateShowtimesDto,
        principalId: string,
        idempotencyKey: string
    ): Promise<RequestShowtimeCreationResponse> {
        this.assertStartTimesDoNotOverlap(createDto)

        const now = DateUtil.now()
        const claim = await this.submissions.acquire(
            principalId,
            idempotencyKey,
            fingerprintShowtimeCreation(createDto),
            now,
            DateUtil.add({ base: now, milliseconds: SUBMISSION_CLAIM_LEASE_MS })
        )

        if (claim.kind === 'key-reused') {
            throw new ConflictException(IdempotencyErrors.KeyReused())
        }
        if (claim.kind === 'in-progress') {
            throw new ConflictException(IdempotencyErrors.RequestInProgress())
        }
        if (claim.kind === 'accepted') return { sagaId: claim.sagaId }

        try {
            await this.orchestrator.ensureShowtimeCreationJobStarted(createDto, claim.sagaId)
            const accepted = await this.submissions.markAccepted(
                principalId,
                idempotencyKey,
                claim.claimId,
                DateUtil.now()
            )
            if (!accepted) {
                throw new Error('Showtime creation submission claim was lost before acceptance.')
            }
        } catch (error) {
            await this.submissions.release(principalId, idempotencyKey, claim.claimId)
            throw error
        }

        return { sagaId: claim.sagaId }
    }

    async getShowtimeCreationStatus(sagaId: string, principalId: string) {
        const submission = await this.submissions.findAcceptedBySagaId(principalId, sagaId)
        if (!submission) {
            throw new NotFoundException(ShowtimeCreationErrors.SagaNotFound(sagaId))
        }

        return this.orchestrator.getShowtimeCreationStatus(sagaId)
    }

    // 검증 액티비티는 기존 상영과의 충돌만 보므로, 요청 안에서 서로 겹치는 시작 시각은
    // 사가를 시작하기 전에 입력 오류로 거절한다.
    // 같은 상영 길이가 모든 극장에 적용되므로, 시작 시각 간격이 상영 길이보다 짧으면(중복 포함) 반드시 겹친다.
    private assertStartTimesDoNotOverlap({
        durationInMinutes,
        startTimes
    }: BulkCreateShowtimesDto) {
        const sorted = [...startTimes].sort(DateUtil.compare)
        const durationMs = durationInMinutes * 60 * 1000

        const overlapping: Temporal.Instant[] = []
        let prev: Temporal.Instant | undefined
        for (const start of sorted) {
            if (
                prev &&
                DateUtil.toEpochMilliseconds(start) - DateUtil.toEpochMilliseconds(prev) <
                    durationMs
            ) {
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
        return this.showtimesService.search({ endTimeRange: { start: DateUtil.now() }, theaterIds })
    }

    async searchTheatersPage(searchDto: PaginationDto) {
        return this.theatersService.searchPage(searchDto)
    }
}
