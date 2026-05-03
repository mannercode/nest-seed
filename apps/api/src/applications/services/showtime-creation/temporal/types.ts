import type { ShowtimeDto } from 'cores'
import { getProjectId } from 'config'
import type { BulkCreateShowtimesDto } from '../dtos'

export type ShowtimeCreationWorkflowInput = { createDto: BulkCreateShowtimesDto; sagaId: string }

export type ValidateAndCreateResult =
    | { kind: 'failed'; conflictingShowtimes: ShowtimeDto[] }
    | { kind: 'succeeded'; createdShowtimeCount: number; createdTicketCount: number }

export const SHOWTIME_CREATION_WORKFLOW = 'showtimeCreationWorkflow'

// Task queue is namespaced by PROJECT_ID so parallel test workers (each
// with a unique PROJECT_ID) don't pick up one another's workflows. In
// production PROJECT_ID is fixed so the queue name is stable.
export function getShowtimeCreationTaskQueue() {
    return `showtime-creation-${getProjectId()}`
}
