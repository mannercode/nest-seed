import { Require } from '@mannercode/common'

/**
 * 모듈 로드 시점 (예: `@Module` 데코레이터 안의 `cache:${...}`) 에 PROJECT_ID 가
 * 필요한 곳에서 사용한다. 그 시점엔 NestJS DI 가 안 떠 있어 AppConfigService 인스턴스를
 * 못 부르므로 process.env 를 직접 읽는다. ConfigModule 의 Joi 검증은 그 다음 단계인
 * NestFactory.create 시점에 다시 한 번 PROJECT_ID 존재를 보장한다.
 */
export function getProjectId(): string {
    Require.defined(process.env.PROJECT_ID, 'PROJECT_ID must be defined.')
    return process.env.PROJECT_ID
}
