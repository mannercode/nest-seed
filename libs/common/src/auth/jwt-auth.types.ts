export type AuthConfig = {
    accessSecret: string
    accessTokenTtlMs: number
    audience: string
    issuer: string
    refreshSecret: string
    refreshTokenTtlMs: number
}

/**
 * Out-of-band metadata about the operation being performed. Threaded into
 * security events so consumers (audit log, SIEM, alerting) can attribute
 * actions to a request. JwtAuthService never inspects these — it just relays.
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
     * JWT payload field used to identify the subject for the per-user
     * revocation index. Defaults to `'sub'` (RFC 7519 standard claim).
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
