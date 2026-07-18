import { Require } from '@mannercode/common'

// 모듈 데코레이터 평가 시점에는 DI가 아직 없어 환경 변수를 직접 읽어야 한다.
export function getProjectId(): string {
    Require.defined(process.env.PROJECT_ID, 'PROJECT_ID must be defined.')
    return process.env.PROJECT_ID
}
