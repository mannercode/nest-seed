import { DynamicModule, Injectable, Module, UnauthorizedException } from '@nestjs/common'
import { JwtModule, JwtService } from '@nestjs/jwt'
import { CacheService, generateShortId, notUsed, stringToMillisecs } from 'common'

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
        private readonly config: AuthConfig,
        private readonly cache: CacheService
    ) {}

    static getToken(name: string) {
        return `JwtService_${name}`
    }

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
            { ...payload, jti: generateShortId() },
            { secret, expiresIn }
        )
        return token
    }

    private async storeRefreshToken(userId: string, refreshToken: string) {
        await this.cache.set(
            userId,
            refreshToken,
            // TODO 이거 MS로 받게 바꿔라
            stringToMillisecs(this.config.refreshTokenExpiration)
        )
    }

    private async getStoredRefreshToken(userId: string) {
        return this.cache.get(userId)
    }
}

export type JwtAuthModuleOptions = { auth: AuthConfig; cache: CacheService }

@Module({})
export class JwtAuthModule {
    static forRootAsync(
        options: {
            useFactory: (...args: any[]) => Promise<JwtAuthModuleOptions> | JwtAuthModuleOptions
            inject: any[]
        },
        name: string
    ): DynamicModule {
        const jwtServiceToken = JwtAuthService.getToken(name)

        return {
            module: JwtAuthModule,
            imports: [JwtModule.register({})],
            providers: [
                {
                    provide: jwtServiceToken,
                    useFactory: async (jwtService: JwtService, ...args: any[]) => {
                        const { auth, cache } = await options.useFactory(...args)
                        return new JwtAuthService(jwtService, auth, cache)
                    },
                    inject: [JwtService, ...options.inject]
                }
            ],
            exports: [jwtServiceToken]
        }
    }
}
