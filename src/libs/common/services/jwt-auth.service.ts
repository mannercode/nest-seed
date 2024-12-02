import {
    DynamicModule,
    Global,
    Inject,
    Injectable,
    Module,
    UnauthorizedException
} from '@nestjs/common'
import { JwtModule, JwtService } from '@nestjs/jwt'
import { CacheModuleOptions, generateShortId, millisecsToString, notUsed } from 'common'
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

@Global()
@Module({})
export class JwtAuthModule {
    static getRedisToken(name: string) {
        return `JWT_AUTH_REDIS_${name}`
    }

    static getPrefixToken(name: string) {
        return `JWT_AUTH_PREFIX_${name}`
    }

    static forRootAsync(
        configKey: string,
        options: {
            useFactory: (...args: any[]) => Promise<CacheModuleOptions> | CacheModuleOptions
            inject: any[]
        }
    ): DynamicModule {
        const redisProvider = {
            provide: JwtAuthModule.getRedisToken(configKey),
            useFactory: async (...args: any[]) => {
                const { connection } = await options.useFactory(...args)
                return connection
            },
            inject: options.inject
        }
        const prefixProvider = {
            provide: JwtAuthModule.getPrefixToken(configKey),
            useFactory: async (...args: any[]) => {
                const { prefix } = await options.useFactory(...args)
                return prefix
            },
            inject: options.inject
        }

        return {
            module: JwtAuthModule,
            providers: [redisProvider, prefixProvider],
            exports: [redisProvider, prefixProvider]
        }
    }

    static registerJwtAuth(options: {
        configKey: string
        name: string
        useFactory: (...args: any[]) => Promise<{ auth: AuthConfig }> | { auth: AuthConfig }
        inject: any[]
    }): DynamicModule {
        const { configKey, name, useFactory, inject } = options

        const cacheProvider = {
            provide: JwtAuthService.getToken(name),
            useFactory: async (
                jwtService: JwtService,
                redis: Redis,
                prefix: string,
                ...args: any[]
            ) => {
                const { auth } = await useFactory(...args)
                return new JwtAuthService(jwtService, auth, redis, prefix + ':' + name)
            },
            inject: [
                JwtService,
                JwtAuthModule.getRedisToken(configKey),
                JwtAuthModule.getPrefixToken(configKey),
                ...inject
            ]
        }

        return {
            module: JwtAuthModule,
            imports: [JwtModule.register({})],
            providers: [cacheProvider],
            exports: [cacheProvider]
        }
    }
}
