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
     * `TemporalWorkerService` 에 등록할 액티비티 묶음을 돌려준다. Temporal 은
     * 일반 함수로 호출하므로, 각 메서드를 `bind` 해서 `this` 를 잃지 않게
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

        // 검증과 삽입은 한 묶음이라야 한다. 복제본마다 Temporal 워커가
        // 있어서 같은 시간대에 겹치는 saga 두 개가 동시에 돌면, 둘 다
        // 삽입 전에 검증을 통과해 버린다. 그 사이 다른 saga 가 먼저 삽입한
        // 결과를 못 보기 때문이다. 그래서 복제본을 넘는 분산 락으로 검증과
        // 삽입을 한 쌍으로 묶는다. 한 saga 가 끝나기 전엔 다음 saga 가 같은
        // 시간대를 못 본다.
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

    // 워크플로우가 상태 값을 쓸 때 enum 객체를 직접 import 하지 않게 한다.
    // 워크플로우 코드는 샌드박스 안에서 도는데, 바깥의 NestJS 모듈을
    // import 하면 번들이 깨진다. 이 클래스를 통해 한 곳에서만 enum 을
    // 노출한다.
    static readonly Status = ShowtimeCreationStatus
}
