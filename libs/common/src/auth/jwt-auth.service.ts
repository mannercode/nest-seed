import { DynamicModule, Inject, Injectable, Module, UnauthorizedException } from '@nestjs/common'
import { JwtModule, JwtService } from '@nestjs/jwt'
import { createHash } from 'crypto'
import Redis from 'ioredis'
import { getRedisConnectionToken } from '../redis'
import { defaultTo, generateShortId, getByPath, omit } from '../utils'

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

export type AuthConfig = {
    accessSecret: string
    accessTokenTtlMs: number
    audience: string
    issuer: string
    refreshSecret: string
    refreshTokenTtlMs: number
}

export type JwtAuthModuleOptions = {
    inject?: any[]
    name?: string
    prefix: string
    redisName?: string
    useFactory: (...args: any[]) => JwtAuthFactoryOptions | Promise<JwtAuthFactoryOptions>
}

type JwtSignOptionsArg = Parameters<JwtService['signAsync']>[1]
type JwtExpiresIn = NonNullable<JwtSignOptionsArg>['expiresIn']

/**
 * JWT-based auth with **refresh-token rotation** and **reuse detection**.
 *
 * Storage layout in Redis (per JwtAuthService instance, namespaced by `prefix`):
 *
 *   {prefix}:token:{tokenId}    → JSON { hash, familyId }    TTL = refreshTokenTtlMs
 *   {prefix}:family:{familyId}  → SET of live tokenIds       TTL = refreshTokenTtlMs (extended on rotation)
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
 */
@Injectable()
export class JwtAuthService {
    constructor(
        private readonly jwtService: JwtService,
        private readonly config: AuthConfig,
        private readonly redis: Redis,
        public readonly prefix: string
    ) {}

    static getName(name?: string) {
        return `JwtAuthService_${defaultTo(name, 'default')}`
    }

    async generateAuthTokens(payload: object): Promise<JwtAuthTokens> {
        const familyId = generateShortId(30)
        return this.issueTokensInFamily(payload, familyId)
    }

    async refreshAuthTokens(refreshToken: string): Promise<JwtAuthTokens> {
        const payload = await this.getAuthTokenPayload(refreshToken)
        const tokenId = getByPath(payload, 'refreshTokenId') as string | undefined
        const familyId = getByPath(payload, 'familyId') as string | undefined

        if (!tokenId || !familyId) {
            throw new UnauthorizedException(JwtAuthErrors.RefreshTokenInvalid())
        }

        const stored = await this.getStoredToken(tokenId, familyId)

        if (!stored) {
            // Token entry missing. Either expired or already rotated. If the
            // family is still alive, an old token is being replayed — likely
            // theft. Burn the entire family so no one can keep refreshing.
            const familyStillAlive = await this.redis.exists(this.familyKey(familyId))
            if (familyStillAlive) {
                await this.revokeFamily(familyId)
                throw new UnauthorizedException(JwtAuthErrors.RefreshTokenReuseDetected())
            }
            throw new UnauthorizedException(JwtAuthErrors.RefreshTokenInvalid())
        }

        if (stored.hash !== this.hashToken(refreshToken) || stored.familyId !== familyId) {
            throw new UnauthorizedException(JwtAuthErrors.RefreshTokenInvalid())
        }

        // Consume this token before issuing the next one so the same window
        // can't accept the same refresh twice.
        await this.consumeToken(tokenId, familyId)

        const carryPayload = omit(payload, ['refreshTokenId', 'familyId'])
        return this.issueTokensInFamily(carryPayload, familyId)
    }

    async revokeRefreshToken(refreshToken: string): Promise<void> {
        let payload: Record<string, unknown>
        try {
            payload = await this.getAuthTokenPayload(refreshToken)
        } catch {
            // Logout is best-effort: an unparseable / expired token can't
            // identify a family, so there's nothing to revoke. Stay quiet
            // rather than telling the caller their token was malformed.
            return
        }
        const familyId = getByPath(payload, 'familyId') as string | undefined
        if (familyId) await this.revokeFamily(familyId)
    }

    private async issueTokensInFamily(payload: object, familyId: string): Promise<JwtAuthTokens> {
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
        await this.storeToken(refreshTokenId, familyId, refreshToken)
        return { accessToken, refreshToken }
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

    private async getAuthTokenPayload(token: string) {
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

            throw new UnauthorizedException(JwtAuthErrors.RefreshTokenVerificationFailed(message))
        }
    }

    private hashToken(token: string): string {
        return createHash('sha256').update(token).digest('hex')
    }

    /**
     * Both keys embed `{familyId}` as a Redis Cluster hash tag so every key
     * for one family lands on the same slot — required because we use MULTI
     * pipelines that touch token + family entries atomically (Redis Cluster
     * rejects multi-key ops crossing slots: `CROSSSLOT`).
     */
    private tokenKey(tokenId: string, familyId: string) {
        return `${this.prefix}:{${familyId}}:token:${tokenId}`
    }

    private familyKey(familyId: string) {
        return `${this.prefix}:{${familyId}}:family`
    }

    private async getStoredToken(
        tokenId: string,
        familyId: string
    ): Promise<{ familyId: string; hash: string } | null> {
        const raw = await this.redis.get(this.tokenKey(tokenId, familyId))
        if (!raw) return null
        return JSON.parse(raw) as { familyId: string; hash: string }
    }

    private async storeToken(tokenId: string, familyId: string, refreshToken: string) {
        const ttlMs = this.config.refreshTokenTtlMs
        const value = JSON.stringify({ familyId, hash: this.hashToken(refreshToken) })
        // Pipeline so token + family update land together; the family TTL is
        // refreshed on each rotation so the family lives as long as any
        // member could be valid.
        await this.redis
            .multi()
            .set(this.tokenKey(tokenId, familyId), value, 'PX', ttlMs)
            .sadd(this.familyKey(familyId), tokenId)
            .pexpire(this.familyKey(familyId), ttlMs)
            .exec()
    }

    private async consumeToken(tokenId: string, familyId: string) {
        await this.redis
            .multi()
            .del(this.tokenKey(tokenId, familyId))
            .srem(this.familyKey(familyId), tokenId)
            .exec()
    }

    private async revokeFamily(familyId: string) {
        const tokenIds = await this.redis.smembers(this.familyKey(familyId))
        const pipeline = this.redis.multi()
        for (const tokenId of tokenIds) {
            pipeline.del(this.tokenKey(tokenId, familyId))
        }
        pipeline.del(this.familyKey(familyId))
        await pipeline.exec()
    }
}

type JwtAuthFactoryOptions = { auth: AuthConfig }

export class JwtAuthTokens {
    accessToken: string
    refreshToken: string
}

export function InjectJwtAuth(name?: string): ParameterDecorator {
    return Inject(JwtAuthService.getName(name))
}

@Module({})
export class JwtAuthModule {
    static register(options: JwtAuthModuleOptions): DynamicModule {
        const { inject, name, prefix, redisName, useFactory } = options

        const jwtAuthProvider = {
            inject: [JwtService, getRedisConnectionToken(redisName), ...defaultTo(inject, [])],
            provide: JwtAuthService.getName(name),
            useFactory: async (jwtService: JwtService, redis: Redis, ...args: any[]) => {
                const { auth } = await useFactory(...args)

                return new JwtAuthService(
                    jwtService,
                    auth,
                    redis,
                    `${prefix}:${defaultTo(name, 'default')}`
                )
            }
        }

        return {
            exports: [jwtAuthProvider],
            imports: [JwtModule.register({})],
            module: JwtAuthModule,
            providers: [jwtAuthProvider]
        }
    }
}
