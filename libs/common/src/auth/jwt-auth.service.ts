import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Redis } from 'ioredis'
import type { AuthConfig, EventContext, JwtAuthTokens, OnSecurityEvent } from './jwt-auth.types.js'
import { DateUtil, defaultTo, generateShortId, getByPath, omit, sha256 } from '../utils/index.js'

export const JwtAuthErrors = {
    RefreshTokenReplaced: () => ({
        code: 'ERR_JWT_AUTH_REFRESH_TOKEN_REPLACED',
        message: 'The refresh token has already been replaced'
    }),
    RefreshTokenInvalid: () => ({
        code: 'ERR_JWT_AUTH_REFRESH_TOKEN_INVALID',
        message: 'The provided refresh token is invalid'
    })
}

const JWT_ALGORITHM = 'HS256' as const
const ROTATE_SESSION_SCRIPT = `
    local current = redis.call('GET', KEYS[1])
    if not current then return 0 end
    if current ~= ARGV[1] then return 2 end
    redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[3])
    redis.call('PEXPIRE', KEYS[2], ARGV[3])
    return 1
`

/** 로그인 세션마다 현재 리프레시 토큰의 해시 하나만 보관한다. */
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
        const userId = this.getUserId(payload)
        const sessionId = generateShortId(30)
        const tokens = await this.createTokens(payload, sessionId)
        const ttlMs = this.config.refreshTokenTtlMs

        // 세션과 사용자 목록은 같은 hash slot에 둬 함께 생성한다.
        await this.redis
            .multi()
            .set(
                this.sessionKey(userId, sessionId),
                sha256(tokens.refreshToken, 'hex'),
                'PX',
                ttlMs
            )
            .sadd(this.userSessionsKey(userId), sessionId)
            .pexpire(this.userSessionsKey(userId), ttlMs)
            .exec()
        await this.onEvent({ type: 'token.issued', userId, sessionId, at: DateUtil.now(), context })
        return tokens
    }

    async refreshAuthTokens(refreshToken: string, context?: EventContext): Promise<JwtAuthTokens> {
        const payload = await this.getAuthTokenPayload(refreshToken, context)
        const { userId, sessionId } = this.getSession(payload)
        const tokens = await this.createTokens(omit(payload, ['sessionId']), sessionId)

        // 새 토큰을 준비한 뒤 현재 해시와 원자 교체한다. 로그아웃이 먼저 세션을 지웠으면
        // 교체에 실패하므로, 폐기 표시나 유예 타이머 없이도 세션이 되살아나지 않는다.
        const result = await this.redis.eval(
            ROTATE_SESSION_SCRIPT,
            2,
            this.sessionKey(userId, sessionId),
            this.userSessionsKey(userId),
            sha256(refreshToken, 'hex'),
            sha256(tokens.refreshToken, 'hex'),
            this.config.refreshTokenTtlMs
        )
        if (result === 0) throw new UnauthorizedException(JwtAuthErrors.RefreshTokenInvalid())
        if (result === 2) throw new ConflictException(JwtAuthErrors.RefreshTokenReplaced())
        if (result !== 1) throw new Error('Refresh token rotation returned an invalid result')

        await this.onEvent({
            type: 'token.refreshed',
            userId,
            sessionId,
            at: DateUtil.now(),
            context
        })
        return tokens
    }

    async revokeRefreshToken(refreshToken: string, context?: EventContext): Promise<void> {
        const payload = await this.getAuthTokenPayload(refreshToken, context, false)
        const { userId, sessionId } = this.getSession(payload)
        await this.redis
            .multi()
            .del(this.sessionKey(userId, sessionId))
            .srem(this.userSessionsKey(userId), sessionId)
            .exec()
        await this.onEvent({
            type: 'session.revoked',
            userId,
            sessionId,
            reason: 'logout',
            at: DateUtil.now(),
            context
        })
    }

    async revokeAllForUser(userId: string, context?: EventContext): Promise<void> {
        const userKey = this.userSessionsKey(userId)
        const sessionIds = await this.redis.smembers(userKey)
        if (sessionIds.length === 0) return

        // 조회한 세션만 제거한다. 그 이후 새 로그인으로 추가된 세션의 인덱스는 보존한다.
        await this.redis
            .multi()
            .del(...sessionIds.map((sessionId) => this.sessionKey(userId, sessionId)))
            .srem(userKey, ...sessionIds)
            .exec()
        for (const sessionId of sessionIds) {
            await this.onEvent({
                type: 'session.revoked',
                userId,
                sessionId,
                reason: 'logout_all',
                at: DateUtil.now(),
                context
            })
        }
    }

    private async createTokens(payload: object, sessionId: string): Promise<JwtAuthTokens> {
        const accessToken = await this.createToken(
            payload,
            this.config.accessSecret,
            this.config.accessTokenTtlMs
        )
        const refreshToken = await this.createToken(
            { ...payload, sessionId },
            this.config.refreshSecret,
            this.config.refreshTokenTtlMs
        )
        return { accessToken, refreshToken }
    }

    private async createToken(payload: object, secret: string, ttlMs: number) {
        return this.jwtService.signAsync<object>(
            { ...payload, jti: generateShortId() },
            {
                algorithm: JWT_ALGORITHM,
                audience: this.config.audience,
                expiresIn: Math.floor(ttlMs / 1000),
                issuer: this.config.issuer,
                secret
            }
        )
    }

    private async getAuthTokenPayload(token: string, context?: EventContext, emitOnFailure = true) {
        const peek = this.jwtService.decode<Record<string, unknown> | null>(token)
        const exp = peek?.exp
        if (typeof exp === 'number' && exp < DateUtil.toEpochMilliseconds(DateUtil.now()) / 1000) {
            if (emitOnFailure) {
                await this.onEvent({
                    type: 'verify.failed',
                    reason: 'token expired',
                    at: DateUtil.now(),
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
                await this.onEvent({
                    type: 'verify.failed',
                    reason: (error as Error).message,
                    at: DateUtil.now(),
                    context
                })
            }
            throw new UnauthorizedException(JwtAuthErrors.RefreshTokenInvalid())
        }
    }

    private getSession(payload: Record<string, unknown>) {
        const userId = this.getUserId(payload)
        const { sessionId } = payload
        if (typeof sessionId !== 'string' || !sessionId) {
            throw new UnauthorizedException(JwtAuthErrors.RefreshTokenInvalid())
        }
        return { userId, sessionId }
    }

    private getUserId(payload: object): string {
        const value = getByPath(payload, this.userIdField)
        if (typeof value !== 'string' || !value) {
            throw new UnauthorizedException(JwtAuthErrors.RefreshTokenInvalid())
        }
        return value
    }

    private sessionKey(userId: string, sessionId: string) {
        return `${this.prefix}:{${userId}}:session:${sessionId}`
    }

    private userSessionsKey(userId: string) {
        return `${this.prefix}:{${userId}}:sessions`
    }
}
