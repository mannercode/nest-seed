export type AuthConfig = {
    accessSecret: string
    accessTokenTtlMs: number
    audience: string
    issuer: string
    refreshSecret: string
    refreshTokenTtlMs: number
}

/**
 * 보안 이벤트와 함께 전달하는 부가 정보인다. 감사 로그, SIEM, 알림 같은
 * 후속 소비자가 어떤 요청에서 일어난 일인지 추적할 수 있게 한다.
 * `JwtAuthService`는 이 값을 들여다보지 않고 그대로 전달만 한다.
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
    onEvent: OnSecurityEvent
    /**
     * 사용자 단위 무효화 인덱스를 만들 때 어떤 클레임으로 사용자를 식별할지 지정한다.
     * 기본값은 RFC 7519의 표준 클레임인 `'sub'`이다.
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
