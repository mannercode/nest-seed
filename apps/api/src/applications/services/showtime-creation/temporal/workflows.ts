import { proxyActivities } from '@temporalio/workflow'
import type { ShowtimeCreationActivities } from './activities'
import type { ShowtimeCreationWorkflowInput } from './types'
import { extractRootMessage } from './extract-root-message'

const { compensate, emitStatusChanged, validateAndCreate } = proxyActivities<
    ReturnType<ShowtimeCreationActivities['bind']>
>({
    // Validate+create lock can wait up to 10 minutes (`waitMs`) before
    // throwing, so the activity timeout is set above that to absorb the
    // worst case without spurious cancellations.
    startToCloseTimeout: '15 minutes',
    // Don't auto-retry — the workflow's catch block runs compensate and
    // surfaces an Error status. Retrying would cause duplicate side effects.
    retry: { maximumAttempts: 1 }
})

export async function showtimeCreationWorkflow(
    input: ShowtimeCreationWorkflowInput
): Promise<void> {
    // Status string literals match the ShowtimeCreationStatus union in
    // services/types.ts. We don't import the const object — workflow code is
    // sandboxed and pulling in a sibling module that transitively requires
    // `@nestjs/common` decorators makes Webpack bundling fail.
    await emitStatusChanged({ sagaId: input.sagaId, status: 'processing' })

    try {
        const result = await validateAndCreate(input)

        if (result.kind === 'succeeded') {
            await emitStatusChanged({
                createdShowtimeCount: result.createdShowtimeCount,
                createdTicketCount: result.createdTicketCount,
                sagaId: input.sagaId,
                status: 'succeeded'
            })
        } else {
            await emitStatusChanged({
                conflictingShowtimes: result.conflictingShowtimes,
                sagaId: input.sagaId,
                status: 'failed'
            })
        }
    } catch (error: unknown) {
        await compensate(input.sagaId)
        await emitStatusChanged({
            message: extractRootMessage(error),
            sagaId: input.sagaId,
            status: 'error'
        })
    }
}
