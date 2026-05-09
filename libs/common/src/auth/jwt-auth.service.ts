import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
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
    }),
    RefreshTokenVerificationFailed: (message: string) => ({
        code: 'ERR_JWT_AUTH_REFRESH_TOKEN_VERIFICATION_FAILED',
        message
    })
}

const JWT_ALGORITHM = 'HS256' as const

type JwtSignOptionsArg = Parameters<JwtService['signAsync']>[1]
type JwtExpiresIn = NonNullable<JwtSignOptionsArg>['expiresIn']

/**
 * **refresh-token rotation** 과 **reuse detection** 을 갖춘 JWT 기반 auth.
 *
 * Redis 저장 구조 (JwtAuthService instance 별, `prefix` 로 namespacing):
 *
 *   {prefix}:{familyId}:token:{tokenId}    → JSON { hash, familyId }    TTL = refreshTokenTtlMs
 *   {prefix}:{familyId}:family             → 살아있는 tokenId 의 SET    TTL = refreshTokenTtlMs (rotation 시 연장)
 *   {prefix}:user:{userId}:families        → user 의 familyId SET       TTL = refreshTokenTtlMs (rotation 시 연장)
 *
 * - **Hash 저장**: SHA-256(refreshToken) 만 보관하고 raw JWT 는 client 에만
 *   존재한다. Redis dump 가 유출되어도 그대로 쓸 수 있는 token 이 공격자 손에
 *   바로 들어가지는 않는다.
 * - **Rotation**: refresh 가 성공하면 소비된 token entry 를 삭제하고 같은
 *   family 안에서 새 tokenId 를 발급한다.
 * - **Reuse detection**: 이미 rotation 된 token (token entry 는 사라졌지만
 *   family 는 아직 살아있는 상태) 이 제시되면 도난으로 간주 → family 전체를
 *   날려서 정상 user 와 공격자 모두 더 이상 refresh 하지 못하게 한다.
 * - **Algorithm pinning + iss/aud claim** 으로 algorithm-confusion 공격을
 *   막고, secret 을 공유하는 다른 service 가 발급한 token 을 차단한다.
 * - **per-user index** 덕분에 `revokeAllForUser` (예: 비밀번호 변경이나
 *   "전체 로그아웃") 가 가능하다. userId 는 설정된 `userIdField` (기본
 *   `'sub'`, RFC 7519) 를 통해 JWT payload 에서 뽑아낸다.
 */
@Injectable()
export class JwtAuthService {
    private readonly logger = new Logger(JwtAuthService.name)

    // `userIdField` 에 기본값을 두지 않는다 — JwtAuthModule.register 가 항상
    // `defaultTo(userIdField, DEFAULT_USER_ID_FIELD)` 로 해소하므로 TS 의
    // 기본값은 dead code (커버되지 않는 branch) 가 된다. 직접 instantiate 할
    // 때는 field 를 명시적으로 넘겨야 한다.
    constructor(
        private readonly jwtService: JwtService,
        private readonly config: AuthConfig,
        private readonly redis: Redis,
        public readonly prefix: string,
        private readonly userIdField: string,
        private readonly onEvent?: OnSecurityEvent
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

        // 다음 token 을 발급하기 전에 이 token 을 소비해서 같은 window 가
        // 동일한 refresh 를 두 번 받아주지 못하게 한다. atomic DEL 의 count
        // 로 같은 tokenId 에 대한 동시 refresh race 에서 우리가 이겼는지
        // 알 수 있다 — race 의 패자는 이미 rotation 된 token 이 replay 된
        // 경우와 구분할 수 없으므로, reuse detection 이 family 를 태운다.
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
        let payload: Record<string, unknown>
        try {
            payload = await this.getAuthTokenPayload(refreshToken, context, false)
        } catch {
            return
        }
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
        try {
            const decoded = await this.jwtService.verifyAsync(token, {
                algorithms: [JWT_ALGORITHM],
                audience: this.config.audience,
                issuer: this.config.issuer,
                secret: this.config.refreshSecret
            })
            const payload = omit(decoded, ['aud', 'exp', 'iat', 'iss', 'jti'])

            return payload
        } catch (error: unknown) {
            const message = getByPath(error, 'message', String(error))

            if (emitOnFailure) {
                await this.emit({ type: 'verify.failed', reason: message, at: new Date(), context })
            }
            throw new UnauthorizedException(JwtAuthErrors.RefreshTokenVerificationFailed(message))
        }
    }

    private getUserId(payload: unknown): string | undefined {
        const value = getByPath(payload, this.userIdField)
        return typeof value === 'string' ? value : undefined
    }

    private hashToken(token: string): string {
        return createHash('sha256').update(token).digest('hex')
    }

    /**
     * 두 key 모두 `{familyId}` 를 Redis Cluster hash tag 로 박아서 한 family
     * 의 모든 key 가 같은 slot 에 떨어지도록 한다 — token + family entry 를
     * atomic 하게 다루는 MULTI pipeline 을 쓰기 때문에 필요하다 (Redis
     * Cluster 는 slot 을 넘나드는 multi-key 연산을 `CROSSSLOT` 으로 거부).
     * per-user index 는 따로 (non-MULTI 로) 다루므로 `{userId}` 를 쓴다.
     */
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
        // result[0] 가 DEL 응답: [err, count]. count > 0 이면 동시 소비자
        // 들과의 race 에서 우리가 이긴 것이고, 0 이면 다른 worker 가 이미
        // entry 를 지운 것이다.
        //
        // ioredis 의 `multi().exec()` 타입은 `Array<[Error | null, unknown]>
        // | null` — null 은 transaction 이 abort (예: connection error) 된
        // 경우에 나온다. 그 경우 DEL 이 실제로 돌았는지 알 수 없으므로
        // 짐작하지 않고 그대로 throw 한다: false 를 돌리면 일시적 error 일
        // 수 있는데 family 를 태워버리고, true 를 돌리면 같은 source 에서
        // 유효 token 두 개가 나갈 수 있다. throw 된 error 는 5xx 가 되어
        // client 가 재시도할 수 있고 family 는 그대로 유지된다.
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
        if (!this.onEvent) return
        try {
            await this.onEvent(event)
        } catch (err) {
            // hook 실패가 authentication 을 깨뜨려서는 안 된다. log 만 남기고 계속.
            this.logger.error('onEvent hook failed', err)
        }
    }
}
