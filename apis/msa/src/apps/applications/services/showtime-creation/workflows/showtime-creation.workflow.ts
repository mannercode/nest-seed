import { log, proxyActivities } from '@temporalio/workflow'
import type { SerializedBulkCreateShowtimesDto, ShowtimeCreationActivities } from '../activities'
import { ShowtimeCreationStatus } from '../services/types'

const { emitStatusChanged, validateShowtimes, createShowtimes, compensateShowtimeCreation } =
    proxyActivities<ShowtimeCreationActivities>({
        startToCloseTimeout: '5m',
        retry: { maximumAttempts: 1 }
    })

export async function showtimeCreationWorkflow(input: {
    sagaId: string
    createDto: SerializedBulkCreateShowtimesDto
}) {
    const { sagaId, createDto } = input

    log.info('showtimeCreationWorkflow', { sagaId })

    try {
        await emitStatusChanged({ sagaId, status: ShowtimeCreationStatus.Processing })

        const { isValid, conflictingShowtimes } = await validateShowtimes(createDto)
        log.info('showtimeCreationWorkflow validateShowtimes completed', {
            sagaId,
            isValid,
            conflictCount: conflictingShowtimes.length
        })

        if (isValid) {
            const creationResult = await createShowtimes(createDto, sagaId)
            log.info('showtimeCreationWorkflow createShowtimes completed', {
                sagaId,
                ...creationResult
            })

            await emitStatusChanged({
                sagaId,
                status: ShowtimeCreationStatus.Succeeded,
                ...creationResult
            })
        } else {
            await emitStatusChanged({
                conflictingShowtimes,
                sagaId,
                status: ShowtimeCreationStatus.Failed
            })
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
        } catch (compensateError) {
            log.error('compensation failed', {
                sagaId,
                error:
                    compensateError instanceof Error
                        ? compensateError.message
                        : String(compensateError)
            })
        }

        await emitStatusChanged({ message, sagaId, status: ShowtimeCreationStatus.Error })
    }
}
