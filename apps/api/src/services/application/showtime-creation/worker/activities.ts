import { CacheService, InjectCache, JsonUtil } from '@mannercode/common'
import { Injectable, Logger } from '@nestjs/common'
import { Context, heartbeat } from '@temporalio/activity'
import {
    ShowtimeCreationPersistenceService,
    type ShowtimeCreationEvent,
    type ValidateAndCreateResult
} from '../internal'
import { ShowtimeCreationEvents } from '../showtime-creation.events'
import { LEGACY_VALIDATE_CREATE_LOCK_KEY } from './legacy-lock'
import { ShowtimeCreationWorkflowInput } from './types'

export type { ValidateAndCreateResult } from '../internal'

const HEARTBEAT_INTERVAL_MS = 5_000
// v1 binary가 잡을 수 있는 legacy lock과 교차 직렬화하는 rolling-migration fence다.
// transaction 자체는 45초 안에 끝나므로 TTL이 먼저 만료되지 않게 여유를 둔다.
// old v1이 이미 15분 lock을 보유한 전환 구간에는 5분 SSE 상한을 넘겨 기다리지 않고 재시도 후 error로 끝난다.
// 무중단 가용성까지 필요하면 신규 enqueue 전에 v1 workflow/worker drain을 운영 절차로 보장해야 한다.
const COMPATIBILITY_LOCK_TTL_MS = 55_000
const COMPATIBILITY_LOCK_WAIT_MS = 8_000

@Injectable()
export class ShowtimeCreationActivities {
    private readonly logger = new Logger(ShowtimeCreationActivities.name)

    constructor(
        private readonly events: ShowtimeCreationEvents,
        private readonly persistence: ShowtimeCreationPersistenceService,
        @InjectCache('showtime-creation') private readonly cache: CacheService
    ) {}

    // Temporal은 일반 함수로 호출하므로 인스턴스 컨텍스트를 고정한다.
    bind() {
        return {
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
        const context = Context.current()

        heartbeat({ phase: 'started', sagaId })
        const timer = setInterval(
            () => heartbeat({ phase: 'transaction', sagaId }),
            HEARTBEAT_INTERVAL_MS
        )
        timer.unref()

        try {
            const result = await this.cache.withLockBlocking(
                LEGACY_VALIDATE_CREATE_LOCK_KEY,
                COMPATIBILITY_LOCK_TTL_MS,
                () =>
                    this.persistence.validateAndCreate(
                        createDto,
                        sagaId,
                        context.cancellationSignal
                    ),
                { signal: context.cancellationSignal, waitMs: COMPATIBILITY_LOCK_WAIT_MS }
            )
            heartbeat({ phase: 'committed', sagaId })
            this.logger.log('validateAndCreate completed', { kind: result.kind, sagaId })
            return result
        } finally {
            clearInterval(timer)
        }
    }
}
