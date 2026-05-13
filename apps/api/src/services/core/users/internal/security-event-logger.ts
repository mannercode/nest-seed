import type { AppLoggerService, SecurityEvent } from '@mannercode/common'

/**
 * `JwtAuthService`가 발행하는 보안 이벤트를 받아 애플리케이션 로거로 넘긴다.
 * 영구 감사 로그(저장소, 보관 기간, 민감 정보 마스킹)는 별도 결정이 필요하다.
 * 그 결정을 미루는 동안에도 이 훅이 비어 있지 않게 유지하는 역할이다.
 *
 * `@Injectable`을 붙이지 않았다. `UsersModule`의 useFactory가 직접 `new`로 만들고
 * `handle`만 콜백으로 떼어 넘긴다. NestJS DI 그래프에 등록할 필요가 없다.
 */
export class SecurityEventLogger {
    constructor(private readonly logger: AppLoggerService) {}

    handle = (event: SecurityEvent): void => {
        const message = `security_event:${event.type}`

        switch (event.type) {
            case 'token.reuse_detected':
                this.logger.error(message, event)
                return
            case 'verify.failed':
                this.logger.warn(message, event)
                return
            case 'family.revoked':
            case 'token.issued':
            case 'token.refreshed':
                this.logger.log(message, event)
                return
        }
    }
}
