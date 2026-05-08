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
 * JWT-based auth with **refresh-token rotation** and **reuse detection**.
 *
 * Storage layout in Redis (per JwtAuthService instance, namespaced by `prefix`):
 *
 *   {prefix}:{familyId}:token:{tokenId}    → JSON { hash, familyId }    TTL = refreshTokenTtlMs
 *   {prefix}:{familyId}:family             → SET of live tokenIds       TTL = refreshTokenTtlMs (extended on rotation)
 *   {prefix}:user:{userId}:families        → SET of familyIds for user  TTL = refreshTokenTtlMs (extended on rotation)
 *
 * - **Hash storage**: only SHA-256(refreshToken) is kept; the raw JWT lives only
 *   on the client. A Redis dump leak doesn't directly hand attackers usable
 *   tokens.
 * - **Rotation**: a successful refresh deletes the consumed token entry and
 *   issues a new tokenId in the same family.
 * - **Reuse detection**: presenting an already-rotated token (token entry gone
 *   but family still alive) is treated as theft → the entire family is purged
 *   so neither the legitimate user nor the attacker can refresh further.
 * - **Algorithm pinning + iss/aud claims** prevent algorithm-confusion attacks
 *   and block tokens minted by other services that happen to share a secret.
 * - **Per-user index** enables `revokeAllForUser` (e.g., on password change or
 *   "log out everywhere"). The userId is extracted from the JWT payload using
 *   the configured `userIdField` (default `'sub'`, per RFC 7519).
 */
@Injectable()
export class JwtAuthService {
    private readonly logger = new Logger(JwtAuthService.name)

    // No default on `userIdField` — JwtAuthModule.register always resolves it
    // through `defaultTo(userIdField, DEFAULT_USER_ID_FIELD)` so a TS default
    // here would be dead code (an uncovered branch). Direct instantiations
    // must pass the field explicitly.
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

        // Consume this token before issuing the next one so the same window
        // can't accept the same refresh twice. Atomic DEL count tells us
        // whether we won the race against concurrent refreshes of the same
        // tokenId — a loser is indistinguishable from a replayed
        // already-rotated token, so reuse detection burns the family.
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
     * Both keys embed `{familyId}` as a Redis Cluster hash tag so every key
     * for one family lands on the same slot — required because we use MULTI
     * pipelines that touch token + family entries atomically (Redis Cluster
     * rejects multi-key ops crossing slots: `CROSSSLOT`). The per-user
     * index uses `{userId}` instead — touched in separate (non-MULTI) calls.
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
        // result[0] is the DEL reply: [err, count]. count > 0 means we won
        // the race against concurrent consumers; 0 means another worker
        // already deleted the entry.
        const result = (await this.redis
            .multi()
            .del(this.tokenKey(tokenId, familyId))
            .srem(this.familyKey(familyId), tokenId)
            .exec()) as [Error | null, number][]
        const [, count] = result[0]
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
            // Hook failures must not break authentication. Log and continue.
            this.logger.error('onEvent hook failed', err)
        }
    }
}
