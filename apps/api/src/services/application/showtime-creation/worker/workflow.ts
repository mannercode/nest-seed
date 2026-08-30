import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import * as restate from '@restatedev/restate-sdk'
import { AppConfigService } from '#config'
import type { ShowtimeCreationEvent, ValidateAndCreateResult } from '../internal/index.js'
import type { ShowtimeCreationWorkflowInput } from './types.js'
// 이 직접 import는 internal barrel → orchestrator → worker로 되돌아오는 Nest DI 순환을 피한다.
// eslint-disable-next-line no-restricted-imports
import { ShowtimeCreationPersistenceService } from '../internal/showtime-creation-persistence.service.js'
import { ShowtimeCreationEvents } from '../showtime-creation.events.js'
import { TemporalJsonSerde } from './temporal-json.serde.js'

const EVENT_RETRY = { initialRetryInterval: 1_000, maxRetryAttempts: 3, maxRetryDuration: 35_000 }
const EVENT_ATTEMPT_TIMEOUT_MS = 10_000
const VALIDATE_AND_CREATE_RETRY = {
    initialRetryInterval: 1_000,
    maxRetryAttempts: 4,
    maxRetryDuration: 195_000
}
const DEFAULT_RUN_TIMEOUT_MS = 60_000

type WorkflowDependencies = {
    events: Pick<ShowtimeCreationEvents, 'emitStatusChanged'>
    persistence: Pick<ShowtimeCreationPersistenceService, 'validateAndCreate'>
    projectId: string
    runTimeoutMs?: number
}

export function getShowtimeCreationWorkflowName(projectId: string) {
    return `ShowtimeCreation-${projectId}`
}

export function createShowtimeCreationWorkflow({
    events,
    persistence,
    projectId,
    runTimeoutMs = DEFAULT_RUN_TIMEOUT_MS
}: WorkflowDependencies) {
    const emit = (ctx: restate.WorkflowContext, name: string, event: ShowtimeCreationEvent) =>
        ctx.run(name, () => withEventAttemptTimeout(events.emitStatusChanged(event)), EVENT_RETRY)

    return restate.workflow({
        handlers: {
            run: async (
                ctx: restate.WorkflowContext,
                input: ShowtimeCreationWorkflowInput
            ): Promise<void> => {
                await emit(ctx, 'emit waiting', { sagaId: input.sagaId, status: 'waiting' })
                await emit(ctx, 'emit processing', { sagaId: input.sagaId, status: 'processing' })

                let result: ValidateAndCreateResult
                try {
                    result = await ctx.run(
                        'validate and create',
                        () => {
                            const { createDto, sagaId } = input
                            const signal = AbortSignal.any([
                                ctx.request().attemptCompletedSignal,
                                AbortSignal.timeout(runTimeoutMs)
                            ])

                            return persistence.validateAndCreate(createDto, sagaId, signal)
                        },
                        VALIDATE_AND_CREATE_RETRY
                    )
                } catch (error: unknown) {
                    if (error instanceof restate.CancelledError) throw error

                    await emit(ctx, 'emit error', {
                        message: error instanceof Error ? error.message : String(error),
                        sagaId: input.sagaId,
                        status: 'error'
                    })
                    return
                }

                if (result.kind === 'succeeded') {
                    await emit(ctx, 'emit succeeded', {
                        createdShowtimeCount: result.createdShowtimeCount,
                        createdTicketCount: result.createdTicketCount,
                        sagaId: input.sagaId,
                        status: 'succeeded'
                    })
                } else {
                    await emit(ctx, 'emit failed', {
                        conflictingShowtimes: result.conflictingShowtimes,
                        sagaId: input.sagaId,
                        status: 'failed'
                    })
                }
            }
        },
        name: getShowtimeCreationWorkflowName(projectId),
        options: {
            abortTimeout: 5_000,
            asTerminalError: (error: unknown) => {
                if (error instanceof BadRequestException || error instanceof NotFoundException) {
                    return new restate.TerminalError(error.message, {
                        errorCode: error.getStatus()
                    })
                }
                return undefined
            },
            inactivityTimeout: runTimeoutMs + 5_000,
            serde: TemporalJsonSerde,
            workflowRetention: 60 * 60 * 1_000
        }
    })
}

async function withEventAttemptTimeout(operation: Promise<void>) {
    let timer!: ReturnType<typeof setTimeout>
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
            () =>
                reject(
                    new Error(`Status event publish timed out after ${EVENT_ATTEMPT_TIMEOUT_MS}ms.`)
                ),
            EVENT_ATTEMPT_TIMEOUT_MS
        )
    })

    try {
        await Promise.race([operation, timeout])
    } finally {
        clearTimeout(timer)
    }
}

export type ShowtimeCreationWorkflowDefinition = ReturnType<typeof createShowtimeCreationWorkflow>

@Injectable()
export class ShowtimeCreationWorkflow {
    readonly definition: ShowtimeCreationWorkflowDefinition

    constructor(
        events: ShowtimeCreationEvents,
        persistence: ShowtimeCreationPersistenceService,
        config: AppConfigService
    ) {
        this.definition = createShowtimeCreationWorkflow({
            events,
            persistence,
            projectId: config.projectId
        })
    }
}
