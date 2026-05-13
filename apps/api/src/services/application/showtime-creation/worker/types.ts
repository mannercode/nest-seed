import { getProjectId } from 'config'
import type { BulkCreateShowtimesDto } from '../dtos'

export type ShowtimeCreationWorkflowInput = { createDto: BulkCreateShowtimesDto; sagaId: string }

/**
 * 작업 큐 이름에 `PROJECT_ID`를 포함해 병렬 테스트 워커의 워크플로 실행 공간을
 * 분리한다. 운영에서는 `PROJECT_ID`가 고정되어 큐 이름도 안정적으로 유지된다.
 */
export function getShowtimeCreationTaskQueue() {
    return `showtime-creation-${getProjectId()}`
}
