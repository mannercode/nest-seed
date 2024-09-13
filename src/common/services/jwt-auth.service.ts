import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { generateUUID, notUsed } from 'common'
import { CacheService } from './cache.service'

const REFRESH_TOKEN_PREFIX = 'refreshToken:'

export interface AuthTokenPayload {
    userId: string
    email: string
}

export class JwtAuthTokens {
    accessToken: string
    refreshToken: string
}

export interface AuthConfig {
    accessSecret: string
    refreshSecret: string
    accessTokenExpiration: string
    refreshTokenExpiration: string
}

@Injectable()
export class JwtAuthService {
    constructor(
        private readonly jwtService: JwtService,
        private readonly cache: CacheService,
        @Inject('AuthConfig') private readonly config: AuthConfig
    ) {}

    async generateAuthTokens(userId: string, email: string): Promise<JwtAuthTokens> {
        const commonPayload = { userId, email }
        const accessToken = await this.createToken(
            commonPayload,
            this.config.accessSecret,
            this.config.accessTokenExpiration
        )
        const refreshToken = await this.createToken(
            commonPayload,
            this.config.refreshSecret,
            this.config.refreshTokenExpiration
        )
        await this.storeRefreshToken(userId, refreshToken)
        return { accessToken, refreshToken }
    }

    async refreshAuthTokens(refreshToken: string) {
        const payload = await this.getAuthTokenPayload(refreshToken)

        const storedRefreshToken = await this.getStoredRefreshToken(payload.userId)

        /* istanbul ignore if */
        if (storedRefreshToken !== refreshToken) {
            throw new UnauthorizedException(`RefreshToken for ${payload.userId} does not exist`)
        }

        return this.generateAuthTokens(payload.userId, payload.email)
    }

    private async getAuthTokenPayload(token: string) {
        try {
            const secret = this.config.refreshSecret
            const { exp, iat, jti, ...payload } = await this.jwtService.verifyAsync(token, {
                secret
            })
            notUsed(exp, iat, jti)
            return payload
        } catch (error) {
            throw new UnauthorizedException(error.message)
        }
    }

    private async createToken(payload: AuthTokenPayload, secret: string, expiresIn: string) {
        const token = await this.jwtService.signAsync(
            { ...payload, jti: generateUUID() },
            { secret, expiresIn }
        )
        return token
    }

    private async storeRefreshToken(userId: string, refreshToken: string) {
        await this.cache.set(
            `${REFRESH_TOKEN_PREFIX}${userId}`,
            refreshToken,
            this.config.refreshTokenExpiration
        )
    }

    private async getStoredRefreshToken(userId: string) {
        return this.cache.get(`${REFRESH_TOKEN_PREFIX}${userId}`)
    }
}
