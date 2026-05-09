import type { AppLoggerService, SecurityEvent } from '@mannercode/common'

/**
 * JwtAuthService 보안 이벤트의 first-pass consumer. 이벤트를 application
 * logger pipeline 으로 옮긴다. 영구 audit-log 결정 (저장소, 보관 기간, PII
 * 정책) 은 후속 작업으로 미루는 동안, 이 hook 이 dead code 가 되지 않게
 * 유지한다.
 *
 * @Injectable 미사용 — UsersModule 의 useFactory 가 직접 `new` 로 생성해
 * `handle` 만 onEvent 로 떼어 전달한다. Nest DI 그래프에 등록할 필요 없음.
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
