import { CacheService, getByPath, InjectCache, JsonUtil } from '@mannercode/common'
import { Injectable, Logger } from '@nestjs/common'
import { ShowtimesService, TicketsService } from 'core'
import {
    ShowtimeBulkCreatorService,
    ShowtimeBulkValidatorService,
    type ShowtimeCreationEvent,
    type ValidateAndCreateResult
} from '../internal'
import { ShowtimeCreationEvents } from '../showtime-creation.events'
import {
    LEGACY_VALIDATE_CREATE_LOCK_KEY,
    LEGACY_VALIDATE_CREATE_LOCK_TTL_MS,
    LEGACY_VALIDATE_CREATE_LOCK_WAIT_MS
} from './legacy-lock'
import { LegacyShowtimeCreationWorkflowInput } from './legacy-types'

/**
 * 배포 전부터 실행 중인 v1 workflow 전용 Activity다.
 * original queue가 drain될 때까지 activity 이름과 동작을 보존한다.
 */
@Injectable()
export class LegacyShowtimeCreationActivities {
    private readonly logger = new Logger(LegacyShowtimeCreationActivities.name)

    constructor(
        private readonly events: ShowtimeCreationEvents,
        private readonly validatorService: ShowtimeBulkValidatorService,
        private readonly creatorService: ShowtimeBulkCreatorService,
        private readonly showtimesService: ShowtimesService,
        private readonly ticketsService: TicketsService,
        @InjectCache('showtime-creation') private readonly cache: CacheService
    ) {}

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
        input: LegacyShowtimeCreationWorkflowInput
    ): Promise<ValidateAndCreateResult> {
        const { createDto, sagaId } = JsonUtil.reviveDates(input)

        return this.cache.withLockBlocking<ValidateAndCreateResult>(
            LEGACY_VALIDATE_CREATE_LOCK_KEY,
            LEGACY_VALIDATE_CREATE_LOCK_TTL_MS,
            async () => {
                const { conflictingShowtimes, isValid } =
                    await this.validatorService.validate(createDto)

                if (isValid) {
                    const creationResult = await this.creatorService.create(createDto, sagaId)
                    return { kind: 'succeeded', ...creationResult }
                }
                return { conflictingShowtimes, kind: 'failed' }
            },
            { waitMs: LEGACY_VALIDATE_CREATE_LOCK_WAIT_MS }
        )
    }

    async compensate(sagaId: string): Promise<void> {
        await this.cache.withLockBlocking(
            LEGACY_VALIDATE_CREATE_LOCK_KEY,
            LEGACY_VALIDATE_CREATE_LOCK_TTL_MS,
            async () => {
                const targets = ['tickets', 'showtimes'] as const
                const results = await Promise.allSettled([
                    this.ticketsService.deleteBySagaIds([sagaId]),
                    this.showtimesService.deleteBySagaIds([sagaId])
                ])
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
            { waitMs: LEGACY_VALIDATE_CREATE_LOCK_WAIT_MS }
        )
    }
}
