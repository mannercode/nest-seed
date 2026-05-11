import { CacheService, getByPath, InjectCache, JsonUtil } from '@mannercode/common'
import { Injectable, Logger } from '@nestjs/common'
import { ShowtimesService, TicketsService } from 'core'
import {
    ShowtimeBulkCreatorService,
    ShowtimeBulkValidatorService,
    ShowtimeCreationEvent,
    ShowtimeCreationStatus
} from '../internal'
import { ShowtimeCreationEvents } from '../showtime-creation.events'
import { ShowtimeCreationWorkflowInput, ValidateAndCreateResult } from './types'

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
     * `TemporalWorkerService`에 등록할 액티비티 묶음을 반환합니다. Temporal은
     * 일반 함수로 호출하므로, 각 메서드를 `bind` 해서 `this`를 잃지 않게
     * 합니다.
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

        // 검증과 삽입은 복제본 경계를 넘어 원자적으로 취급해야 합니다. 두 워커가
        // 같은 시간대의 saga를 동시에 검증하면, 서로의 아직 삽입되지 않은 결과를
        // 보지 못해 둘 다 통과할 수 있습니다. 분산 락 안에서 검증과 삽입을 함께
        // 실행해 같은 시간대는 한 saga씩 처리합니다.
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

    // 워크플로우가 상태 값을 쓸 때 enum 객체를 직접 import 하지 않게 합니다.
    // 워크플로우 코드는 샌드박스 안에서 실행되는데, 바깥의 NestJS 모듈을
    // import 하면 번들이 실패합니다. 이 클래스를 통해 한 곳에서만 enum을
    // 노출합니다.
    static readonly Status = ShowtimeCreationStatus
}
