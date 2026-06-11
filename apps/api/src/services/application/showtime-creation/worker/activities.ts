import { CacheService, getByPath, InjectCache, JsonUtil } from '@mannercode/common'
import { Injectable, Logger } from '@nestjs/common'
import { ShowtimeDto, ShowtimesService, TicketsService } from 'core'
import {
    ShowtimeBulkCreatorService,
    ShowtimeBulkValidatorService,
    ShowtimeCreationEvent
} from '../internal'
import { ShowtimeCreationEvents } from '../showtime-creation.events'
import { ShowtimeCreationWorkflowInput } from './types'

export type ValidateAndCreateResult =
    | { kind: 'failed'; conflictingShowtimes: ShowtimeDto[] }
    | { kind: 'succeeded'; createdShowtimeCount: number; createdTicketCount: number }

const VALIDATE_CREATE_LOCK_KEY = 'validate-and-create'
// 임계 구역(검증+삽입)의 상한.
// `validateAndCreate`의 startToCloseTimeout(15분)과 같게 두어, 워커가 죽었을 때만 락이 만료되고 정상 실행 중에는 풀리지 않게 한다.
const VALIDATE_CREATE_LOCK_TTL_MS = 15 * 60 * 1000
const VALIDATE_CREATE_LOCK_WAIT_MS = 10 * 60 * 1000

@Injectable()
export class ShowtimeCreationActivities {
    private readonly logger = new Logger(ShowtimeCreationActivities.name)

    constructor(
        private readonly events: ShowtimeCreationEvents,
        private readonly validatorService: ShowtimeBulkValidatorService,
        private readonly creatorService: ShowtimeBulkCreatorService,
        private readonly showtimesService: ShowtimesService,
        private readonly ticketsService: TicketsService,
        @InjectCache('showtime-creation') private readonly cache: CacheService
    ) {}

    /**
     * `TemporalWorkerService`에 등록할 액티비티 묶음을 반환한다.
     * Temporal은 일반 함수로 호출하므로 각 메서드를 `bind`해 `this`를 잃지 않게 한다.
     */
    bind() {
        return {
            compensate: this.compensate.bind(this),
            emitStatusChanged: this.emitStatusChanged.bind(this),
            validateAndCreate: this.validateAndCreate.bind(this)
        }
    }

    async emitStatusChanged(payload: ShowtimeCreationEvent): Promise<void> {
        await this.events.emitStatusChanged(payload)
    }

    async validateAndCreate(
        input: ShowtimeCreationWorkflowInput
    ): Promise<ValidateAndCreateResult> {
        const { createDto, sagaId } = JsonUtil.reviveDates(input)

        // 검증과 삽입은 복제본 경계를 넘어 원자적으로 취급해야 한다.
        // 두 워커가 같은 시간대의 사가를 동시에 검증하면, 아직 삽입되지 않은 서로의 결과를 보지 못해 둘 다 통과할 수 있다.
        // 분산 락 안에서 검증과 삽입을 함께 실행해 같은 시간대는 한 사가씩 처리한다.
        return this.cache.withLockBlocking<ValidateAndCreateResult>(
            VALIDATE_CREATE_LOCK_KEY,
            VALIDATE_CREATE_LOCK_TTL_MS,
            async () => {
                const { conflictingShowtimes, isValid } =
                    await this.validatorService.validate(createDto)

                if (isValid) {
                    const creationResult = await this.creatorService.create(createDto, sagaId)
                    return { kind: 'succeeded', ...creationResult }
                }
                return { conflictingShowtimes, kind: 'failed' }
            },
            { waitMs: VALIDATE_CREATE_LOCK_WAIT_MS }
        )
    }

    async compensate(sagaId: string): Promise<void> {
        // 타임아웃으로 버려진 `validateAndCreate`가 아직 락 안에서 삽입 중일 수 있다.
        // 같은 락을 기다렸다가 정리해, 좀비 실행과 경합해 고아 행이 남는 일을 막는다.
        await this.cache.withLockBlocking(
            VALIDATE_CREATE_LOCK_KEY,
            VALIDATE_CREATE_LOCK_TTL_MS,
            async () => {
                const targets = ['tickets', 'showtimes'] as const
                const results = await Promise.allSettled([
                    this.ticketsService.deleteBySagaIds([sagaId]),
                    this.showtimesService.deleteBySagaIds([sagaId])
                ])

                // 한쪽이 실패해도 다른 쪽 삭제는 이미 시도된 상태다.
                // 실패를 던져 Temporal 재시도 정책이 동작하게 한다. 삭제는 멱등이라 전체 재실행이 안전하다.
                const failures = results
                    .map((result, i) => ({ result, target: targets[i] }))
                    .filter(({ result }) => result.status === 'rejected')

                if (0 < failures.length) {
                    const reasons = failures
                        .map(
                            ({ result, target }) =>
                                `${target}=${getByPath(result, 'reason.message', 'unknown')}`
                        )
                        .join(', ')
                    throw new Error(`compensate failed (sagaId=${sagaId}): ${reasons}`)
                }

                this.logger.log('compensate completed', { sagaId })
            },
            { waitMs: VALIDATE_CREATE_LOCK_WAIT_MS }
        )
    }
}
