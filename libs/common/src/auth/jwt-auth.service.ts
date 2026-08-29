import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { createHash } from 'crypto'
import { Redis } from 'ioredis'
import type {
    AuthConfig,
    EventContext,
    JwtAuthTokens,
    OnSecurityEvent,
    SecurityEvent,
    ValidateAuthPayload
} from './jwt-auth.types.js'
import { defaultTo, generateShortId, getByPath, omit } from '../utils/index.js'

export const JwtAuthErrors = {
    RefreshTokenConcurrent: () => ({
        code: 'ERR_JWT_AUTH_REFRESH_TOKEN_CONCURRENT',
        message: 'A refresh is already in progress'
    }),
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
// 네트워크·멀티 인스턴스에서 같은 refresh가 거의 동시에 도착한 경우만 흡수하는 짧은 유예다.
const CONCURRENT_REFRESH_GRACE_MS = 2_000
const CONSUME_TOKEN_SCRIPT = `
    local deleted = redis.call('DEL', KEYS[1])
    if deleted == 1 then
        redis.call('SREM', KEYS[2], ARGV[1])
        redis.call('SET', KEYS[3], ARGV[2], 'PX', ARGV[3])
    end
    return deleted
`
const STORE_TOKEN_SCRIPT = `
    if redis.call('EXISTS', KEYS[3]) == 1 then
        return 0
    end
    redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[3])
    redis.call('SADD', KEYS[2], ARGV[2])
    redis.call('PEXPIRE', KEYS[2], ARGV[3])
    return 1
`

type JwtSignOptionsArg = Parameters<JwtService['signAsync']>[1]
type JwtExpiresIn = NonNullable<JwtSignOptionsArg>['expiresIn']

/**
 * 리프레시 토큰은 SHA-256 해시만 Redis에 저장하고 사용할 때마다 회전한다.
 * 소비 후 2초 안에 같은 토큰이 다시 오면 동시 요청으로 보고 409로 거절한다.
 * 이 유예가 지난 소비 토큰의 재사용은 해당 family 전체를 폐기한다.
 *
 * `{prefix}:{familyId}:token:{tokenId}` → `{ familyId, hash }` JSON
 * `{prefix}:{familyId}:family` → 살아 있는 tokenId 집합
 * `{prefix}:{familyId}:revoked` → 폐기 후 늦은 토큰 저장을 막는 fence
 * `{prefix}:{familyId}:consumed:{tokenId}` → 2초 동안 유지하는 소비 토큰 해시
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

    async generateAuthTokens(
        payload: object,
        context?: EventContext,
        validatePayload?: ValidateAuthPayload
    ): Promise<JwtAuthTokens> {
        const familyId = generateShortId(30)
        const userId = this.getUserId(payload)
        const result = await this.issueTokensInFamily(payload, familyId, userId)
        if (validatePayload && !(await validatePayload(payload as Record<string, unknown>))) {
            await this.rejectRevokedPayload(payload as Record<string, unknown>, familyId, context)
        }
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

    async refreshAuthTokens(
        refreshToken: string,
        context?: EventContext,
        validatePayload?: ValidateAuthPayload
    ): Promise<JwtAuthTokens> {
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

        if (validatePayload && !(await validatePayload(payload))) {
            await this.rejectRevokedPayload(payload, familyId, context)
        }

        const stored = await this.getStoredToken(tokenId, familyId)

        if (!stored) {
            return this.rejectConsumedOrReused(refreshToken, payload, tokenId, familyId, context)
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
        // 짧은 tombstone 안의 loser는 동시 중복으로만 거절하고, 유예가 지난 재사용만 family 전체를 무효화한다.
        const consumed = await this.consumeToken(refreshToken, tokenId, familyId)
        if (!consumed) {
            return this.rejectConsumedOrReused(refreshToken, payload, tokenId, familyId, context)
        }

        const carryPayload = omit(payload, ['refreshTokenId', 'familyId'])
        const userId = this.getUserId(carryPayload)
        const result = await this.issueTokensInFamily(carryPayload, familyId, userId)

        // 토큰 소비와 새 토큰 저장 사이에 계정이 철회될 수 있으므로 발급 직후 다시 확인한다.
        // 여기서도 경합이 생길 수 있지만, 이후 access/refresh 요청은 같은 버전 검증으로 항상 차단된다.
        if (validatePayload && !(await validatePayload(carryPayload))) {
            await this.rejectRevokedPayload(carryPayload, familyId, context)
        }
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

    private async rejectRevokedPayload(
        payload: Record<string, unknown>,
        familyId: string,
        context?: EventContext
    ): Promise<never> {
        const userId = this.getUserId(payload)
        await this.revokeFamily(familyId, userId)
        await this.emit({
            type: 'verify.failed',
            reason: 'account_revoked',
            at: new Date(),
            context
        })
        throw new UnauthorizedException(JwtAuthErrors.RefreshTokenInvalid())
    }

    private async rejectConsumedOrReused(
        refreshToken: string,
        payload: Record<string, unknown>,
        tokenId: string,
        familyId: string,
        context?: EventContext
    ): Promise<never> {
        if (await this.isConcurrentDuplicate(refreshToken, tokenId, familyId)) {
            await this.rejectConcurrentRefresh(context)
        }

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

    private revokedFamilyKey(familyId: string) {
        return `${this.prefix}:{${familyId}}:revoked`
    }

    private consumedTokenKey(tokenId: string, familyId: string) {
        return `${this.prefix}:{${familyId}}:consumed:${tokenId}`
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

        if (userId) {
            await this.redis
                .multi()
                .sadd(this.userFamiliesKey(userId), familyId)
                .pexpire(this.userFamiliesKey(userId), ttlMs)
                .exec()
        }

        // revoke fence 확인과 family/token 저장을 한 슬롯의 Lua로 묶는다. 저장이 먼저 끝나면 뒤의
        // revoke가 지우고, revoke가 먼저 fence를 세우면 이 저장은 절대 family를 되살리지 못한다.
        const result = await this.redis.eval(
            STORE_TOKEN_SCRIPT,
            3,
            this.tokenKey(tokenId, familyId),
            this.familyKey(familyId),
            this.revokedFamilyKey(familyId),
            value,
            tokenId,
            ttlMs.toString()
        )
        if (result !== 1) {
            // 사용자 인덱스는 다른 Redis Cluster 슬롯이라 Lua에 포함할 수 없다. 먼저 등록해 revokeAll이
            // 진행 중 발급도 발견하게 하고, fence에 막힌 경우 여기서 되돌린다.
            if (userId) {
                await this.redis.srem(this.userFamiliesKey(userId), familyId)
            }
            throw new UnauthorizedException(JwtAuthErrors.RefreshTokenInvalid())
        }
    }

    private async consumeToken(
        refreshToken: string,
        tokenId: string,
        familyId: string
    ): Promise<boolean> {
        // 소비와 짧은 tombstone 기록을 한 슬롯의 Lua로 묶어 loser가 실제 재사용과 동시 중복을 구분하게 한다.
        const result = await this.redis.eval(
            CONSUME_TOKEN_SCRIPT,
            3,
            this.tokenKey(tokenId, familyId),
            this.familyKey(familyId),
            this.consumedTokenKey(tokenId, familyId),
            tokenId,
            this.hashToken(refreshToken),
            CONCURRENT_REFRESH_GRACE_MS.toString()
        )
        if (typeof result !== 'number') {
            throw new Error('Refresh token consume aborted: redis eval returned a non-number')
        }
        return result > 0
    }

    private async isConcurrentDuplicate(
        refreshToken: string,
        tokenId: string,
        familyId: string
    ): Promise<boolean> {
        const consumedHash = await this.redis.get(this.consumedTokenKey(tokenId, familyId))
        return consumedHash === this.hashToken(refreshToken)
    }

    private async rejectConcurrentRefresh(context?: EventContext): Promise<never> {
        await this.emit({
            type: 'verify.failed',
            reason: 'concurrent_refresh',
            at: new Date(),
            context
        })
        throw new ConflictException(JwtAuthErrors.RefreshTokenConcurrent())
    }

    private async revokeFamily(familyId: string, userId: string | undefined) {
        // fence를 토큰 정리보다 먼저 세운다. 이후 storeToken의 Lua는 같은 family 슬롯에서 이를 보고
        // 실패하므로, 아래 목록 조회와 삭제 사이에 새 토큰이 끼어들 수 없다.
        await this.redis.set(
            this.revokedFamilyKey(familyId),
            '1',
            'PX',
            this.config.refreshTokenTtlMs
        )
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
