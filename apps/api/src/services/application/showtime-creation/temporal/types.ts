import type { ShowtimeDto } from 'core'
import { getProjectId } from 'config'
import type { BulkCreateShowtimesDto } from '../dtos'

export type ShowtimeCreationWorkflowInput = { createDto: BulkCreateShowtimesDto; sagaId: string }

export type ValidateAndCreateResult =
    | { kind: 'failed'; conflictingShowtimes: ShowtimeDto[] }
    | { kind: 'succeeded'; createdShowtimeCount: number; createdTicketCount: number }

export const SHOWTIME_CREATION_WORKFLOW = 'showtimeCreationWorkflow'

// Task queue 이름 앞에 `PROJECT_ID` 를 붙여 namespace 를 나눈다. 그래서
// 병렬 테스트 워커들이 서로의 워크플로우를 끌고 가지 않는다. 운영에서는
// `PROJECT_ID` 가 고정이라 queue 이름도 그대로 유지된다.
export function getShowtimeCreationTaskQueue() {
    return `showtime-creation-${getProjectId()}`
}
