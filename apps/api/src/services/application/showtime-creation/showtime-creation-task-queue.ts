import { getProjectId } from 'config'

/**
 * 작업 큐 이름에 PROJECT_ID를 포함해 병렬 테스트 워커의 실행 공간을 분리한다.
 * 운영에서는 PROJECT_ID가 고정되어 큐 이름도 안정적으로 유지된다.
 */
export function getLegacyShowtimeCreationTaskQueue() {
    return `showtime-creation-${getProjectId()}`
}

export function getShowtimeCreationTaskQueue() {
    return `showtime-creation-v2-${getProjectId()}`
}
