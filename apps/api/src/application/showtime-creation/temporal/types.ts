import type { ShowtimeDto } from 'core'
import { getProjectId } from 'shared'
import type { BulkCreateShowtimesDto } from '../dtos'

export type ShowtimeCreationWorkflowInput = { createDto: BulkCreateShowtimesDto; sagaId: string }

export type ValidateAndCreateResult =
    | { kind: 'failed'; conflictingShowtimes: ShowtimeDto[] }
    | { kind: 'succeeded'; createdShowtimeCount: number; createdTicketCount: number }

export const SHOWTIME_CREATION_WORKFLOW = 'showtimeCreationWorkflow'

// Task queue 는 PROJECT_ID 로 namespace 가 분리되어, 병렬 test worker (각자
// 고유 PROJECT_ID) 가 서로의 workflow 를 가져가지 않는다. production 에서는
// PROJECT_ID 가 고정이라 queue 이름도 안정적이다.
export function getShowtimeCreationTaskQueue() {
    return `showtime-creation-${getProjectId()}`
}
