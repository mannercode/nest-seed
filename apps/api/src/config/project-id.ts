import { Require } from '@mannercode/common'

/**
 * 모듈을 읽어 들이는 시점(예: `@Module` 데코레이터 안의 `cache:${...}`)에
 * `PROJECT_ID`가 필요한 곳이 있다. 그 시점에는 NestJS DI가 아직 초기화되지 않아
 * `AppConfigService`를 부를 수 없다. 그래서 `process.env`를 직접 읽는다.
 * Joi 검증은 다음 단계인 `NestFactory.create` 시점에 한 번 더 실행되면서 같은
 * 값을 확인한다.
 */
export function getProjectId(): string {
    Require.defined(process.env.PROJECT_ID, 'PROJECT_ID must be defined.')
    return process.env.PROJECT_ID
}
