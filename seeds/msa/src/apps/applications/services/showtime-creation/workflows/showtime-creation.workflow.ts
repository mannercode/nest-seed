import { log, proxyActivities } from '@temporalio/workflow'
import type { ShowtimeCreationActivities } from '../activities'

const { emitStatusChanged, validateShowtimes, createShowtimes, compensateShowtimeCreation } =
    proxyActivities<ShowtimeCreationActivities>({
        startToCloseTimeout: '5m',
        retry: { maximumAttempts: 1 }
    })

export async function showtimeCreationWorkflow(input: {
    sagaId: string
    createDto: {
        durationInMinutes: number
        movieId: string
        startTimes: string[]
        theaterIds: string[]
    }
}) {
    const { sagaId, createDto } = input

    log.info('showtimeCreationWorkflow', { sagaId })

    try {
        await emitStatusChanged({ sagaId, status: 'processing' } as any)

        const { isValid, conflictingShowtimes } = await validateShowtimes(createDto as any)
        log.info('showtimeCreationWorkflow validateShowtimes completed', {
            sagaId,
            isValid,
            conflictCount: conflictingShowtimes.length
        })

        if (isValid) {
            const creationResult = await createShowtimes(createDto as any, sagaId)
            log.info('showtimeCreationWorkflow createShowtimes completed', {
                sagaId,
                ...creationResult
            })

            await emitStatusChanged({ sagaId, status: 'succeeded', ...creationResult } as any)
        } else {
            await emitStatusChanged({ conflictingShowtimes, sagaId, status: 'failed' } as any)
        }
    } catch (error: unknown) {
        const cause = error instanceof Error && error.cause instanceof Error ? error.cause : error
        const message = cause instanceof Error ? cause.message : String(cause)

        log.warn('showtimeCreationWorkflow failed, executing compensation', {
            sagaId,
            error: message
        })

        try {
            await compensateShowtimeCreation(sagaId)
        } catch {
            /* compensation best-effort */
        }

        await emitStatusChanged({ message, sagaId, status: 'error' } as any)
    }
}
