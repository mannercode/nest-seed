import { CacheService, getByPath, InjectCache, JsonUtil } from '@mannercode/common'
import { Injectable, Logger } from '@nestjs/common'
import { ShowtimeDto, ShowtimesService, TicketsService } from 'core'
import {
    ShowtimeBulkCreatorService,
    ShowtimeBulkValidatorService,
    ShowtimeCreationEvent,
    ShowtimeCreationStatus
} from '../internal'
import { ShowtimeCreationEvents } from '../showtime-creation.events'
import { ShowtimeCreationWorkflowInput } from './types'

export type ValidateAndCreateResult =
    | { kind: 'failed'; conflictingShowtimes: ShowtimeDto[] }
    | { kind: 'succeeded'; createdShowtimeCount: number; createdTicketCount: number }

const VALIDATE_CREATE_LOCK_KEY = 'validate-and-create'
const VALIDATE_CREATE_LOCK_TTL_MS = 5 * 60 * 1000
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
     * `TemporalWorkerService`에 등록할 액티비티 묶음을 반환한다. Temporal은
     * 일반 함수로 호출하므로 각 메서드를 `bind`해 `this`를 잃지 않게
     * 한다.
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

        // 검증과 삽입은 복제본 경계를 넘어 원자적으로 취급해야 한다. 두 워커가
        // 같은 시간대의 사가를 동시에 검증하면, 아직 삽입되지 않은 서로의 결과를
        // 보지 못해 둘 다 통과할 수 있다. 분산 락 안에서 검증과 삽입을 함께
        // 실행해 같은 시간대는 한 사가씩 처리한다.
        let result!: ValidateAndCreateResult
        await this.cache.withLockBlocking(
            VALIDATE_CREATE_LOCK_KEY,
            VALIDATE_CREATE_LOCK_TTL_MS,
            async () => {
                const { conflictingShowtimes, isValid } =
                    await this.validatorService.validate(createDto)

                if (isValid) {
                    const creationResult = await this.creatorService.create(createDto, sagaId)
                    result = { kind: 'succeeded', ...creationResult }
                } else {
                    result = { conflictingShowtimes, kind: 'failed' }
                }
            },
            { waitMs: VALIDATE_CREATE_LOCK_WAIT_MS }
        )

        return result
    }

    async compensate(sagaId: string): Promise<void> {
        const targets = ['tickets', 'showtimes'] as const
        const results = await Promise.allSettled([
            this.ticketsService.deleteBySagaIds([sagaId]),
            this.showtimesService.deleteBySagaIds([sagaId])
        ])

        this.logger.log('compensate completed', {
            results: results.map((r, i) => ({
                reason: getByPath(r, 'reason.message', getByPath(r, 'reason', undefined)),
                status: r.status,
                target: targets[i]
            })),
            sagaId
        })
    }

    // 워크플로가 상태 값을 쓸 때 enum 객체를 직접 가져오지 않게 한다.
    // 워크플로 코드는 샌드박스 안에서 실행되는데, 바깥의 NestJS 모듈을
    // 가져오면 번들이 실패한다. 이 클래스를 통해 한 곳에서만 enum을
    // 노출한다.
    static readonly Status = ShowtimeCreationStatus
}
