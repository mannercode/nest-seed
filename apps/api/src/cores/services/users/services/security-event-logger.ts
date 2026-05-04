import { AppLoggerService, SecurityEvent } from '@mannercode/common'
import { Injectable } from '@nestjs/common'

/**
 * First-pass consumer for JwtAuthService security events: mirrors them into
 * the application logger pipeline. Keeps the hook from being dead code while
 * we defer the permanent audit-log decision (storage, retention, PII policy)
 * to a follow-up.
 */
@Injectable()
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
