import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { createHash } from 'crypto'
import Redis from 'ioredis'
import { defaultTo, generateShortId, getByPath, omit } from '../utils'
import {
    AuthConfig,
    EventContext,
    JwtAuthTokens,
    OnSecurityEvent,
    SecurityEvent
} from './jwt-auth.types'

export const JwtAuthErrors = {
    RefreshTokenInvalid: () => ({
        code: 'ERR_JWT_AUTH_REFRESH_TOKEN_INVALID',
        message: 'The provided refresh token is invalid'
    }),
    RefreshTokenReuseDetected: () => ({
        code: 'ERR_JWT_AUTH_REFRESH_TOKEN_REUSE_DETECTED',
        message: 'Refresh token reuse detected; the entire session has been revoked'
    })
}

const JWT_ALGORITHM = 'HS256' as const

type JwtSignOptionsArg = Parameters<JwtService['signAsync']>[1]
type JwtExpiresIn = NonNullable<JwtSignOptionsArg>['expiresIn']

/**
 * 리프레시 토큰 회전과 재사용 탐지를 갖춘 JWT 인증 서비스이다.
 *
 * Redis 저장 구조 (인스턴스마다 `prefix`로 분리):
 *
 *   {prefix}:{familyId}:token:{tokenId}   → JSON `{ hash, familyId }`, TTL = 리프레시 만료 시각
 *   {prefix}:{familyId}:family            → 살아 있는 tokenId의 SET, TTL = 리프레시 만료 시각
 *   {prefix}:user:{userId}:families       → 그 사용자의 familyId SET, TTL = 리프레시 만료 시각
 *
 * - 해시만 저장한다. `SHA-256(refreshToken)`만 Redis에 두고, 원본 JWT는
 *   클라이언트에만 둔다. Redis 덤프가 유출되어도 그대로 사용할 수 있는 토큰이
 *   공격자에게 직접 노출되지 않는다.
 * - 리프레시가 성공할 때마다 토큰을 회전한다. 쓴 토큰 항목은 지우고, 같은
 *   토큰 묶음 안에서 새 토큰 ID를 발급한다.
 * - 이미 회전된 토큰(토큰 항목은 사라졌지만 토큰 묶음은 살아 있는 상태)이
 *   다시 제출되면 도난으로 간주한다. 토큰 묶음 전체를 무효화해 정상 사용자와
 *   공격자 모두 더는 리프레시하지 못하게 한다.
 * - 서명 알고리즘을 고정하고 `iss` / `aud` 클레임을 검증한다. 알고리즘 혼동
 *   공격이나, 같은 비밀키로 다른 서비스가 발급한 토큰을 거른다.
 * - 사용자별 토큰 묶음 인덱스 덕에 `revokeAllForUser` (비밀번호 변경, 전체
 *   로그아웃)가 가능하다. 사용자 ID는 `userIdField`가 가리키는 클레임에서
 *   가져온다. 기본값은 RFC 7519의 `sub`이다.
 */
@Injectable()
export class JwtAuthService {
    // `userIdField`에는 일부러 기본값을 두지 않는다.
    // `JwtAuthModule.register`가 호출하기 전에 `defaultTo(userIdField, DEFAULT_USER_ID_FIELD)`로 값을 채워 주므로, 여기 기본값을 둬도 그 분기는 절대 실행되지 않는다.
    // 이 클래스를 직접 `new`로 만든다면 `userIdField`를 반드시 명시한다.
    constructor(
        private readonly jwtService: JwtService,
        private readonly config: AuthConfig,
        private readonly redis: Redis,
        public readonly prefix: string,
        private readonly userIdField: string,
        private readonly onEvent: OnSecurityEvent
    ) {}

    static getName(name?: string) {
        return `JwtAuthService_${defaultTo(name, 'default')}`
    }

    async generateAuthTokens(payload: object, context?: EventContext): Promise<JwtAuthTokens> {
        const familyId = generateShortId(30)
        const userId = this.getUserId(payload)
        const result = await this.issueTokensInFamily(payload, familyId, userId)
        await this.emit({
            type: 'token.issued',
            userId,
            familyId,
            tokenId: result.refreshTokenId,
            at: new Date(),
            context
        })
        return result.tokens
    }

    async refreshAuthTokens(refreshToken: string, context?: EventContext): Promise<JwtAuthTokens> {
        const payload = await this.getAuthTokenPayload(refreshToken, context)
        const tokenId = getByPath(payload, 'refreshTokenId') as string | undefined
        const familyId = getByPath(payload, 'familyId') as string | undefined

        if (!tokenId || !familyId) {
            await this.emit({
                type: 'verify.failed',
                reason: 'invalid_payload',
                at: new Date(),
                context
            })
            throw new UnauthorizedException(JwtAuthErrors.RefreshTokenInvalid())
        }

        const stored = await this.getStoredToken(tokenId, familyId)

        if (!stored) {
            const familyStillAlive = await this.redis.exists(this.familyKey(familyId))
            if (familyStillAlive) {
                const userId = this.getUserId(payload)
                await this.revokeFamily(familyId, userId)
                await this.emit({
                    type: 'token.reuse_detected',
                    userId,
                    familyId,
                    presentedTokenId: tokenId,
                    at: new Date(),
                    context
                })
                await this.emit({
                    type: 'family.revoked',
                    userId,
                    familyId,
                    reason: 'reuse',
                    at: new Date(),
                    context
                })
                throw new UnauthorizedException(JwtAuthErrors.RefreshTokenReuseDetected())
            }
            await this.emit({
                type: 'verify.failed',
                reason: 'token_not_found',
                at: new Date(),
                context
            })
            throw new UnauthorizedException(JwtAuthErrors.RefreshTokenInvalid())
        }

        if (stored.hash !== this.hashToken(refreshToken) || stored.familyId !== familyId) {
            await this.emit({
                type: 'verify.failed',
                reason: 'hash_mismatch',
                at: new Date(),
                context
            })
            throw new UnauthorizedException(JwtAuthErrors.RefreshTokenInvalid())
        }

        // 새 토큰을 발급하기 전에 지금 토큰을 먼저 소비한다.
        // 그래야 같은 토큰 하나로 동시에 들어온 리프레시 두 건이 모두 통과하는 일이 방지된다.
        // 원자적 DEL이 반환하는 카운트로, 같은 토큰을 동시에 쓴 호출 가운데 이 호출이 먼저 지웠는지 알 수 있다.
        // 이 경쟁에서 실패한 호출은 이미 회전된 토큰을 다시 제출한 경우와 구분할 수 없으므로, 재사용 탐지가 토큰 묶음 전체를 무효화한다.
        const consumed = await this.consumeToken(tokenId, familyId)
        if (!consumed) {
            const loserUserId = this.getUserId(payload)
            await this.revokeFamily(familyId, loserUserId)
            await this.emit({
                type: 'token.reuse_detected',
                userId: loserUserId,
                familyId,
                presentedTokenId: tokenId,
                at: new Date(),
                context
            })
            await this.emit({
                type: 'family.revoked',
                userId: loserUserId,
                familyId,
                reason: 'reuse',
                at: new Date(),
                context
            })
            throw new UnauthorizedException(JwtAuthErrors.RefreshTokenReuseDetected())
        }

        const carryPayload = omit(payload, ['refreshTokenId', 'familyId'])
        const userId = this.getUserId(carryPayload)
        const result = await this.issueTokensInFamily(carryPayload, familyId, userId)
        await this.emit({
            type: 'token.refreshed',
            userId,
            familyId,
            oldTokenId: tokenId,
            newTokenId: result.refreshTokenId,
            at: new Date(),
            context
        })
        return result.tokens
    }

    async revokeRefreshToken(refreshToken: string, context?: EventContext): Promise<void> {
        const payload = await this.getAuthTokenPayload(refreshToken, context, false)
        const familyId = getByPath(payload, 'familyId') as string | undefined
        if (!familyId) return

        const userId = this.getUserId(payload)
        await this.revokeFamily(familyId, userId)
        await this.emit({
            type: 'family.revoked',
            userId,
            familyId,
            reason: 'logout',
            at: new Date(),
            context
        })
    }

    async revokeAllForUser(userId: string, context?: EventContext): Promise<void> {
        const userKey = this.userFamiliesKey(userId)
        const familyIds = await this.redis.smembers(userKey)
        for (const familyId of familyIds) {
            await this.revokeFamily(familyId, userId)
            await this.emit({
                type: 'family.revoked',
                userId,
                familyId,
                reason: 'logout_all',
                at: new Date(),
                context
            })
        }
        await this.redis.del(userKey)
    }

    private async issueTokensInFamily(
        payload: object,
        familyId: string,
        userId: string | undefined
    ): Promise<{ refreshTokenId: string; tokens: JwtAuthTokens }> {
        const accessToken = await this.createToken(
            payload,
            this.config.accessSecret,
            this.config.accessTokenTtlMs
        )
        const refreshTokenId = generateShortId(30)
        const refreshToken = await this.createToken(
            { ...payload, familyId, refreshTokenId },
            this.config.refreshSecret,
            this.config.refreshTokenTtlMs
        )
        await this.storeToken(refreshTokenId, familyId, refreshToken, userId)
        return { refreshTokenId, tokens: { accessToken, refreshToken } }
    }

    private async createToken(payload: object, secret: string, ttlMs: number) {
        const expiresIn = Math.floor(ttlMs / 1000) as JwtExpiresIn

        const token = await this.jwtService.signAsync<object>(
            { ...payload, jti: generateShortId() },
            {
                algorithm: JWT_ALGORITHM,
                audience: this.config.audience,
                expiresIn,
                issuer: this.config.issuer,
                secret
            }
        )
        return token
    }

    private async getAuthTokenPayload(token: string, context?: EventContext, emitOnFailure = true) {
        // 만료는 정상 흐름의 일부라 사전 디코드로 잡아 401을 돌려준다.
        // 서명 위조/구조 깨짐도 잘못된 리프레시 토큰이므로 verifyAsync가 던지는 오류를 401로 매핑한다.
        const peek = this.jwtService.decode<Record<string, unknown> | null>(token)
        const exp = peek?.exp
        if (typeof exp === 'number' && exp < Date.now() / 1000) {
            if (emitOnFailure) {
                await this.emit({
                    type: 'verify.failed',
                    reason: 'token expired',
                    at: new Date(),
                    context
                })
            }
            throw new UnauthorizedException('token expired')
        }

        try {
            const decoded = await this.jwtService.verifyAsync(token, {
                algorithms: [JWT_ALGORITHM],
                audience: this.config.audience,
                issuer: this.config.issuer,
                secret: this.config.refreshSecret
            })
            return omit(decoded, ['aud', 'exp', 'iat', 'iss', 'jti'])
        } catch (error) {
            if (emitOnFailure) {
                const { message } = error as Error
                await this.emit({ type: 'verify.failed', reason: message, at: new Date(), context })
            }
            throw new UnauthorizedException(JwtAuthErrors.RefreshTokenInvalid())
        }
    }

    private getUserId(payload: unknown): string | undefined {
        const value = getByPath(payload, this.userIdField)
        return typeof value === 'string' ? value : undefined
    }

    private hashToken(token: string): string {
        return createHash('sha256').update(token).digest('hex')
    }

    // Redis Cluster에서 한 번에 처리할 `token`과 `family` 키는 같은 저장 구역에 있어야 한다.
    // 두 키에 같은 `{familyId}`를 넣어 함께 처리할 수 있게 만든다.
    // 사용자별 목록은 따로 처리하므로 `{userId}`를 사용한다.
    private tokenKey(tokenId: string, familyId: string) {
        return `${this.prefix}:{${familyId}}:token:${tokenId}`
    }

    private familyKey(familyId: string) {
        return `${this.prefix}:{${familyId}}:family`
    }

    private userFamiliesKey(userId: string) {
        return `${this.prefix}:user:{${userId}}:families`
    }

    private async getStoredToken(
        tokenId: string,
        familyId: string
    ): Promise<{ familyId: string; hash: string } | null> {
        const raw = await this.redis.get(this.tokenKey(tokenId, familyId))
        if (!raw) return null
        return JSON.parse(raw) as { familyId: string; hash: string }
    }

    private async storeToken(
        tokenId: string,
        familyId: string,
        refreshToken: string,
        userId: string | undefined
    ) {
        const ttlMs = this.config.refreshTokenTtlMs
        const value = JSON.stringify({ familyId, hash: this.hashToken(refreshToken) })
        await this.redis
            .multi()
            .set(this.tokenKey(tokenId, familyId), value, 'PX', ttlMs)
            .sadd(this.familyKey(familyId), tokenId)
            .pexpire(this.familyKey(familyId), ttlMs)
            .exec()

        if (userId) {
            await this.redis
                .multi()
                .sadd(this.userFamiliesKey(userId), familyId)
                .pexpire(this.userFamiliesKey(userId), ttlMs)
                .exec()
        }
    }

    private async consumeToken(tokenId: string, familyId: string): Promise<boolean> {
        // 결과의 첫 항목이 DEL 응답이다(`[err, count]`).
        // 카운트가 1 이상이면 동시에 들어온 소비자 중 이 호출이 먼저 지웠다는 뜻이다.
        // 0이면 다른 워커가 이미 지운 뒤이다.
        //
        // ioredis의 `multi().exec()`는 트랜잭션이 중단되면(예: 연결 끊김) `null`을 반환한다.
        // 이 경우에는 DEL이 실제로 실행됐는지 알 수 없다.
        // 그래서 짐작하지 않고 그대로 예외를 던진다.
        // false를 반환하면 일시 오류였을 때도 토큰 묶음 전체를 무효화하고, true를 반환하면 같은 토큰에서 유효한 새 토큰이 두 개 발급될 수 있다.
        // 예외를 던지면 5xx가 되어 클라이언트가 다시 시도하고, 토큰 묶음은 그대로 남는다.
        const result = await this.redis
            .multi()
            .del(this.tokenKey(tokenId, familyId))
            .srem(this.familyKey(familyId), tokenId)
            .exec()
        if (!result) {
            throw new Error('Refresh token consume aborted: redis multi exec returned null')
        }
        const [, count] = result[0] as [Error | null, number]
        return count > 0
    }

    private async revokeFamily(familyId: string, userId: string | undefined) {
        const tokenIds = await this.redis.smembers(this.familyKey(familyId))
        const pipeline = this.redis.multi()
        for (const tokenId of tokenIds) {
            pipeline.del(this.tokenKey(tokenId, familyId))
        }
        pipeline.del(this.familyKey(familyId))
        await pipeline.exec()

        if (userId) {
            await this.redis.srem(this.userFamiliesKey(userId), familyId)
        }
    }

    private async emit(event: SecurityEvent) {
        await this.onEvent(event)
    }
}
