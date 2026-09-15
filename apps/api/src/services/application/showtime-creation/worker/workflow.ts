import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
    ServiceUnavailableException
} from '@nestjs/common'
import {
    defineWorkflow,
    isWorkflowCancellation,
    type DurableWorkflowContext
} from '@mannercode/common'
import { AppConfigService } from '#config'
import {
    ValidateAndCreateResultSchema,
    type ShowtimeCreationEvent,
    type ShowtimeCreationTerminalEvent,
    type ValidateAndCreateResult
} from '../internal/index.js'
import { ShowtimeCreationWorkflowInputSchema, type ShowtimeCreationWorkflowInput } from './types.js'
import { ShowtimeCreationPersistenceService } from '../internal/showtime-creation-persistence.service.js'
import { ShowtimeCreationEvents } from '../showtime-creation.events.js'

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
    const logger = new Logger(ShowtimeCreationWorkflow.name)
    const emit = (ctx: DurableWorkflowContext, name: string, event: ShowtimeCreationEvent) =>
        ctx.run(
            name,
            async () => {
                try {
                    await withEventAttemptTimeout(events.emitStatusChanged(event))
                } catch (error) {
                    if (isWorkflowCancellation(error)) throw error
                    logger.warn('Showtime progress notification failed', {
                        error,
                        sagaId: event.sagaId
                    })
                }
            },
            { maxRetryAttempts: 1 }
        )

    return defineWorkflow({
        input: ShowtimeCreationWorkflowInputSchema,
        run: async (
            ctx: DurableWorkflowContext,
            input: ShowtimeCreationWorkflowInput
        ): Promise<ShowtimeCreationTerminalEvent> => {
            await emit(ctx, 'emit waiting', { sagaId: input.sagaId, status: 'waiting' })
            await emit(ctx, 'emit processing', { sagaId: input.sagaId, status: 'processing' })

            let result: ValidateAndCreateResult
            try {
                result = ValidateAndCreateResultSchema.parse(
                    await ctx.run(
                        'validate and create',
                        () => {
                            const { createDto, sagaId } = input
                            const signal = AbortSignal.any([
                                ctx.attemptSignal(),
                                AbortSignal.timeout(runTimeoutMs)
                            ])

                            return persistence.validateAndCreate(createDto, sagaId, signal)
                        },
                        VALIDATE_AND_CREATE_RETRY
                    )
                )
            } catch (error: unknown) {
                if (isWorkflowCancellation(error)) throw error

                const terminal: ShowtimeCreationTerminalEvent = {
                    message: error instanceof Error ? error.message : String(error),
                    sagaId: input.sagaId,
                    status: 'error'
                }
                await emit(ctx, 'emit error', terminal)
                return terminal
            }

            if (result.kind === 'succeeded') {
                const terminal: ShowtimeCreationTerminalEvent = {
                    createdShowtimeCount: result.createdShowtimeCount,
                    createdTicketCount: result.createdTicketCount,
                    sagaId: input.sagaId,
                    status: 'succeeded'
                }
                await emit(ctx, 'emit succeeded', terminal)
                return terminal
            }

            const terminal: ShowtimeCreationTerminalEvent = {
                conflictingShowtimes: result.conflictingShowtimes,
                sagaId: input.sagaId,
                status: 'failed'
            }
            await emit(ctx, 'emit failed', terminal)
            return terminal
        },
        name: getShowtimeCreationWorkflowName(projectId),
        options: {
            abortTimeout: 5_000,
            terminalError: (error: unknown) => {
                if (error instanceof BadRequestException || error instanceof NotFoundException) {
                    return { message: error.message, errorCode: error.getStatus() }
                }
                return undefined
            },
            inactivityTimeout: runTimeoutMs + 5_000,
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
                    new ServiceUnavailableException('Service unavailable', {
                        cause: `Status event publish timed out after ${EVENT_ATTEMPT_TIMEOUT_MS}ms.`
                    })
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
