export type AuthConfig = {
    accessSecret: string
    accessTokenTtlMs: number
    audience: string
    issuer: string
    refreshSecret: string
    refreshTokenTtlMs: number
}

export type JwtAuthFactoryOptions = { auth: AuthConfig }

export type JwtAuthModuleOptions = {
    inject?: any[]
    name?: string
    prefix: string | ((...args: any[]) => Promise<string> | string)
    redisName?: string
    useFactory: (...args: any[]) => JwtAuthFactoryOptions | Promise<JwtAuthFactoryOptions>
}

export class JwtAuthTokens {
    accessToken: string
    refreshToken: string
}
