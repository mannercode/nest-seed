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
     * TemporalWorkerService 에 넘기는 activity bag 을 반환한다. 메서드를 bind 해
     * Temporal 이 plain function 으로 호출할 수 있게 한다.
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

        // validate-then-insert 는 showtimes collection 에 대한 read-modify-write
        // 다. replica 당 Temporal worker 가 하나씩 있으면, 겹치는 saga 두 개가
        // commit 전에 모두 validation 을 통과할 수 있다. cross-replica lock 으로
        // (validate, create) 쌍을 직렬화해, 다른 saga 가 이미 insert 한 상태라면
        // 정확히 한 saga 만 conflicting showtime 을 보게 한다.
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

    // enum 매핑을 한 곳에 모아둔다. 그래야 workflow 코드가 workflow 경계 밖
    // import 없이 깨끗하게 유지된다.
    static readonly Status = ShowtimeCreationStatus
}
