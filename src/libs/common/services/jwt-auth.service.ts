import { getRedisConnectionToken } from '@nestjs-modules/ioredis'
import { DynamicModule, Inject, Injectable, Module, UnauthorizedException } from '@nestjs/common'
import { JwtModule, JwtService } from '@nestjs/jwt'
import Redis from 'ioredis'
import { CommonErrors } from '../common-errors'
import { DateUtil, generateShortId, notUsed } from '../utils'

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
    accessTokenTtlMs: number
    refreshTokenTtlMs: number
}

@Injectable()
export class JwtAuthService {
    constructor(
        private readonly jwtService: JwtService,
        private readonly config: AuthConfig,
        private readonly redis: Redis,
        public readonly prefix: string
    ) {}

    static getToken(name: string) {
        return `JwtAuthService_${name}`
    }

    private getKey(key: string) {
        return `${this.prefix}:${key}`
    }

    async generateAuthTokens(userId: string, email: string): Promise<JwtAuthTokens> {
        const commonPayload = { userId, email }
        const accessToken = await this.createToken(
            commonPayload,
            this.config.accessSecret,
            this.config.accessTokenTtlMs
        )
        const refreshToken = await this.createToken(
            commonPayload,
            this.config.refreshSecret,
            this.config.refreshTokenTtlMs
        )
        await this.storeRefreshToken(userId, refreshToken)
        return { accessToken, refreshToken }
    }

    async refreshAuthTokens(refreshToken: string) {
        const payload = await this.getAuthTokenPayload(refreshToken)

        const storedRefreshToken = await this.getStoredRefreshToken(payload.userId)

        if (storedRefreshToken !== refreshToken) {
            throw new UnauthorizedException(CommonErrors.Auth.RefreshTokenInvalid)
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
            throw new UnauthorizedException({
                ...CommonErrors.Auth.RefreshTokenVerificationFailed,
                message: error.message
            })
        }
    }

    private async createToken(payload: AuthTokenPayload, secret: string, ttlMs: number) {
        const expiresIn = DateUtil.fromMs(ttlMs)

        const token = await this.jwtService.signAsync(
            { ...payload, jti: generateShortId() },
            { secret, expiresIn }
        )
        return token
    }

    private async storeRefreshToken(userId: string, refreshToken: string) {
        await this.redis.set(this.getKey(userId), refreshToken, 'PX', this.config.refreshTokenTtlMs)
    }

    private async getStoredRefreshToken(userId: string) {
        const value = await this.redis.get(this.getKey(userId))
        return value
    }
}

export function InjectJwtAuth(name: string): ParameterDecorator {
    return Inject(JwtAuthService.getToken(name))
}

type JwtAuthFactory = { auth: AuthConfig }

@Module({})
export class JwtAuthModule {
    static register(options: {
        name: string
        redisName: string
        prefix: string
        useFactory: (...args: any[]) => Promise<JwtAuthFactory> | JwtAuthFactory
        inject?: any[]
    }): DynamicModule {
        const { name, redisName, prefix, useFactory, inject } = options

        const cacheProvider = {
            provide: JwtAuthService.getToken(name),
            useFactory: async (jwtService: JwtService, redis: Redis, ...args: any[]) => {
                const { auth } = await useFactory(...args)

                return new JwtAuthService(jwtService, auth, redis, prefix + ':' + name)
            },
            inject: [JwtService, getRedisConnectionToken(redisName), ...(inject ?? [])]
        }

        return {
            module: JwtAuthModule,
            imports: [JwtModule.register({})],
            providers: [cacheProvider],
            exports: [cacheProvider]
        }
    }
}
