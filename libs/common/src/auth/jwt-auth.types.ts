export type AuthConfig = {
    accessSecret: string
    accessTokenTtlMs: number
    audience: string
    issuer: string
    refreshSecret: string
    refreshTokenTtlMs: number
}

/**
 * 수행 중인 operation 에 대한 out-of-band metadata. security event 에 같이
 * 실어 보내서 consumer (audit log, SIEM, alerting) 가 action 을 request 에
 * 귀속시킬 수 있게 한다. JwtAuthService 는 들여다보지 않고 그대로 전달만 한다.
 */
export type EventContext = { ip?: string; userAgent?: string; source?: string }

export type SecurityEvent =
    | {
          type: 'token.issued'
          userId?: string
          familyId: string
          tokenId: string
          at: Date
          context?: EventContext
      }
    | {
          type: 'token.refreshed'
          userId?: string
          familyId: string
          oldTokenId: string
          newTokenId: string
          at: Date
          context?: EventContext
      }
    | {
          type: 'token.reuse_detected'
          userId?: string
          familyId: string
          presentedTokenId: string
          at: Date
          context?: EventContext
      }
    | {
          type: 'family.revoked'
          userId?: string
          familyId: string
          reason: 'logout' | 'reuse' | 'logout_all'
          at: Date
          context?: EventContext
      }
    | { type: 'verify.failed'; reason: string; at: Date; context?: EventContext }

export type OnSecurityEvent = (event: SecurityEvent) => void | Promise<void>

export type JwtAuthFactoryOptions = {
    auth: AuthConfig
    onEvent?: OnSecurityEvent
    /**
     * per-user revocation index 의 subject 식별에 쓰는 JWT payload field.
     * 기본값은 `'sub'` (RFC 7519 표준 claim).
     */
    userIdField?: string
}

export type JwtAuthModuleOptions = {
    inject?: any[]
    name?: string
    prefix: string
    redisName?: string
    useFactory: (...args: any[]) => JwtAuthFactoryOptions | Promise<JwtAuthFactoryOptions>
}

export class JwtAuthTokens {
    accessToken: string
    refreshToken: string
}
