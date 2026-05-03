import { CacheService, getByPath, InjectCache, JsonUtil } from '@mannercode/common'
import { Injectable, Logger } from '@nestjs/common'
import { ShowtimesService, TicketsService } from 'cores'
import {
    ShowtimeBulkCreatorService,
    ShowtimeBulkValidatorService,
    ShowtimeCreationEvent,
    ShowtimeCreationStatus
} from '../services'
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
     * Returns the activity bag passed to TemporalWorkerService. Methods are
     * bound so Temporal can invoke them as plain functions.
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

        // Validate-then-insert is a read-modify-write on the showtimes
        // collection. With one Temporal worker per replica, two overlapping
        // sagas can both pass validation before either commits. A cross-
        // replica lock serializes the (validate, create) pair so exactly
        // one saga sees a conflicting showtime whenever another has
        // already inserted.
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

    // Keep enum mapping in one place so workflow code stays free of imports
    // outside the workflow boundary.
    static readonly Status = ShowtimeCreationStatus
}
