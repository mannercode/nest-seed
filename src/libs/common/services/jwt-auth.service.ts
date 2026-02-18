import { DynamicModule, Inject, Injectable, Module, UnauthorizedException } from '@nestjs/common'
import { JwtModule, JwtService } from '@nestjs/jwt'
import Redis from 'ioredis'
import { defaultTo, get, omit } from 'lodash'
import { getRedisConnectionToken } from '../redis'
import { generateShortId, Time } from '../utils'

export const JwtAuthServiceErrors = {
    RefreshTokenInvalid: {
        code: 'ERR_JWT_AUTH_REFRESH_TOKEN_INVALID',
        message: 'The provided refresh token is invalid'
    },
    RefreshTokenVerificationFailed: {
        code: 'ERR_JWT_AUTH_REFRESH_TOKEN_VERIFICATION_FAILED',
        message: 'Refresh token verification failed'
    }
}

export class JwtAuthTokens {
    accessToken: string
    refreshToken: string
}

export type AuthConfig = {
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

    static getName(name?: string) {
        return `JwtAuthService_${defaultTo(name, 'default')}`
    }

    private getKey(key: string) {
        return `${this.prefix}:${key}`
    }

    async generateAuthTokens(payload: object): Promise<JwtAuthTokens> {
        const accessToken = await this.createToken(
            payload,
            this.config.accessSecret,
            this.config.accessTokenTtlMs
        )
        const refreshTokenId = generateShortId(30)
        const refreshToken = await this.createToken(
            { ...payload, refreshTokenId },
            this.config.refreshSecret,
            this.config.refreshTokenTtlMs
        )
        await this.storeRefreshToken(refreshTokenId, refreshToken)
        return { accessToken, refreshToken }
    }

    async refreshAuthTokens(refreshToken: string) {
        const payload = await this.getAuthTokenPayload(refreshToken)

        const storedRefreshToken = await this.getStoredRefreshToken(payload.refreshTokenId)

        if (storedRefreshToken !== refreshToken) {
            throw new UnauthorizedException(JwtAuthServiceErrors.RefreshTokenInvalid)
        }

        return this.generateAuthTokens(payload)
    }

    private async getAuthTokenPayload(token: string) {
        try {
            const secret = this.config.refreshSecret
            const decoded = await this.jwtService.verifyAsync(token, { secret })
            const payload = omit(decoded, ['exp', 'iat', 'jti'])

            return payload
        } catch (error: unknown) {
            const message = get(error, 'message', String(error))

            throw new UnauthorizedException({
                ...JwtAuthServiceErrors.RefreshTokenVerificationFailed,
                message
            })
        }
    }

    private async createToken(payload: object, secret: string, ttlMs: number) {
        const expiresIn = Time.fromMs(ttlMs)

        const token = await this.jwtService.signAsync<object>(
            { ...payload, jti: generateShortId() },
            { secret, expiresIn }
        )
        return token
    }

    private async storeRefreshToken(refreshTokenId: string, refreshToken: string) {
        await this.redis.set(
            this.getKey(refreshTokenId),
            refreshToken,
            'PX',
            this.config.refreshTokenTtlMs
        )
    }

    private async getStoredRefreshToken(refreshTokenId: string) {
        const value = await this.redis.get(this.getKey(refreshTokenId))
        return value
    }
}

export function InjectJwtAuth(name?: string): ParameterDecorator {
    return Inject(JwtAuthService.getName(name))
}

type JwtAuthFactoryOptions = { auth: AuthConfig }

export type JwtAuthModuleOptions = {
    name?: string
    redisName?: string
    prefix: string
    useFactory: (...args: any[]) => Promise<JwtAuthFactoryOptions> | JwtAuthFactoryOptions
    inject?: any[]
}

@Module({})
export class JwtAuthModule {
    static register(options: JwtAuthModuleOptions): DynamicModule {
        const { name, redisName, prefix, useFactory, inject } = options

        const jwtAuthProvider = {
            provide: JwtAuthService.getName(name),
            useFactory: async (jwtService: JwtService, redis: Redis, ...args: any[]) => {
                const { auth } = await useFactory(...args)

                return new JwtAuthService(
                    jwtService,
                    auth,
                    redis,
                    `${prefix}:${defaultTo(name, 'default')}`
                )
            },
            inject: [JwtService, getRedisConnectionToken(redisName), ...defaultTo(inject, [])]
        }

        return {
            module: JwtAuthModule,
            imports: [JwtModule.register({})],
            providers: [jwtAuthProvider],
            exports: [jwtAuthProvider]
        }
    }
}
