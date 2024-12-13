import { DynamicModule, Inject, Injectable, Module, UnauthorizedException } from '@nestjs/common'
import { JwtModule, JwtService } from '@nestjs/jwt'
import { generateShortId, millisecsToString, notUsed, RedisModule } from 'common'
import Redis from 'ioredis'

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

        /* istanbul ignore if */
        if (storedRefreshToken !== refreshToken) {
            throw new UnauthorizedException({
                code: 'ERR_REFRESH_TOKEN_INVALID',
                message: 'The provided refresh token is invalid.'
            })
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
                code: 'ERR_REFRESH_TOKEN_VERIFICATION_FAILED',
                message: error.message
            })
        }
    }

    private async createToken(payload: AuthTokenPayload, secret: string, ttlMs: number) {
        const expiresIn = millisecsToString(ttlMs)

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

/* istanbul ignore next */
export function InjectJwtAuth(name: string): ParameterDecorator {
    return Inject(JwtAuthService.getToken(name))
}

type JwtAuthFactory = { auth: AuthConfig; prefix: string }

@Module({})
export class JwtAuthModule {
    static register(options: {
        name: string
        redisName: string
        useFactory: (...args: any[]) => Promise<JwtAuthFactory> | JwtAuthFactory
        inject?: any[]
    }): DynamicModule {
        /* prefix를 useFactory에서 받아야 런타임에 생성된다. */
        const { name, redisName, useFactory, inject } = options

        const cacheProvider = {
            provide: JwtAuthService.getToken(name),
            useFactory: async (jwtService: JwtService, redis: Redis, ...args: any[]) => {
                const { auth, prefix } = await useFactory(...args)
                return new JwtAuthService(jwtService, auth, redis, prefix + ':' + name)
            },
            inject: [JwtService, RedisModule.getToken(redisName), ...(inject ?? [])]
        }

        return {
            module: JwtAuthModule,
            imports: [JwtModule.register({})],
            providers: [cacheProvider],
            exports: [cacheProvider]
        }
    }
}
