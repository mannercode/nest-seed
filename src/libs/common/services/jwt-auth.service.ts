import { DynamicModule } from '@nestjs/common'
import { Inject, Injectable, Module, UnauthorizedException } from '@nestjs/common'
import { JwtModule, JwtService } from '@nestjs/jwt'
import Redis from 'ioredis'
import { defaultTo, get, omit } from 'lodash'
import { getRedisConnectionToken } from '../redis'
import { generateShortId } from '../utils'

export const JwtAuthErrors = {
    RefreshTokenInvalid: () => ({
        code: 'ERR_JWT_AUTH_REFRESH_TOKEN_INVALID',
        message: 'The provided refresh token is invalid'
    }),
    RefreshTokenVerificationFailed: (message: string) => ({
        code: 'ERR_JWT_AUTH_REFRESH_TOKEN_VERIFICATION_FAILED',
        message
    })
}

export type AuthConfig = {
    accessSecret: string
    accessTokenTtlMs: number
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

        if (!payload.refreshTokenId) {
            throw new UnauthorizedException(JwtAuthErrors.RefreshTokenInvalid())
        }

        const storedRefreshToken = await this.getStoredRefreshToken(payload.refreshTokenId)

        if (storedRefreshToken !== refreshToken) {
            throw new UnauthorizedException(JwtAuthErrors.RefreshTokenInvalid())
        }

        return this.generateAuthTokens(payload)
    }

    private async createToken(payload: object, secret: string, ttlMs: number) {
        const expiresIn = Math.floor(ttlMs / 1000) as JwtExpiresIn

        const token = await this.jwtService.signAsync<object>(
            { ...payload, jti: generateShortId() },
            { expiresIn, secret }
        )
        return token
    }

    private async getAuthTokenPayload(token: string) {
        try {
            const secret = this.config.refreshSecret
            const decoded = await this.jwtService.verifyAsync(token, { secret })
            const payload = omit(decoded, ['exp', 'iat', 'jti'])

            return payload
        } catch (error: unknown) {
            const message = get(error, 'message', String(error))

            throw new UnauthorizedException(JwtAuthErrors.RefreshTokenVerificationFailed(message))
        }
    }

    private getKey(key: string) {
        return `${this.prefix}:${key}`
    }

    private async getStoredRefreshToken(refreshTokenId: string) {
        const value = await this.redis.get(this.getKey(refreshTokenId))
        return value
    }

    private async storeRefreshToken(refreshTokenId: string, refreshToken: string) {
        await this.redis.set(
            this.getKey(refreshTokenId),
            refreshToken,
            'PX',
            this.config.refreshTokenTtlMs
        )
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
