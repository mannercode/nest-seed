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
 * 리프레시 토큰은 SHA-256 해시만 Redis에 저장하고 사용할 때마다 회전한다.
 * 소비된 토큰이 다시 오면 해당 family 전체를 폐기한다.
 *
 * `{prefix}:{familyId}:token:{tokenId}` → 토큰 해시
 * `{prefix}:{familyId}:family` → 살아 있는 tokenId 집합
 * `{prefix}:user:{userId}:families` → 사용자별 family 집합
 */
@Injectable()
export class JwtAuthService {
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
        // 만료만 별도 401로 구분하고 나머지 검증 오류는 invalid token으로 통일한다.
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
        // DEL count가 1인 소비자만 승자다. exec 결과가 없으면 실행 여부를 추측하지 않고 실패시킨다.
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
