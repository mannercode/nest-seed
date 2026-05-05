import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService, JwtVerifyOptions } from '@nestjs/jwt'
import { defaultTo } from '../utils'
import { IS_PUBLIC_KEY } from './public.decorator'

const DEFAULT_ALGORITHMS: JwtVerifyOptions['algorithms'] = ['HS256']

export type JwtAuthGuardOptions = {
    /**
     * Allowed signing algorithms. Defaults to `['HS256']`. Pinning blocks
     * JWT algorithm-confusion attacks (forcing `none`, swapping HS↔RS).
     */
    algorithms?: JwtVerifyOptions['algorithms']
    /** Required `aud` claim. Tokens with a different audience are rejected. */
    audience?: string
    /** Required `iss` claim. Tokens with a different issuer are rejected. */
    issuer?: string
    secret: string
}

@Injectable()
export abstract class JwtAuthGuard implements CanActivate {
    constructor(
        protected readonly jwtService: JwtService,
        protected readonly reflector: Reflector,
        protected readonly options: JwtAuthGuardOptions
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        if (this.isPublicRoute(context)) {
            return true
        }

        if (this.isUsingLocalAuth(context)) {
            return true
        }

        const request = context.switchToHttp().getRequest()
        const token = this.extractBearerToken(request)

        if (!token) {
            throw new UnauthorizedException()
        }

        try {
            const payload = await this.jwtService.verifyAsync(token, this.verifyOptions())
            request.user = payload
        } catch {
            throw new UnauthorizedException()
        }

        return true
    }

    protected isPublicRoute(context: ExecutionContext): boolean {
        return this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass()
        ])
    }

    protected isUsingLocalAuth(_context: ExecutionContext): boolean {
        return false
    }

    protected verifyOptions(): JwtVerifyOptions {
        const { algorithms, audience, issuer, secret } = this.options
        return { algorithms: defaultTo(algorithms, DEFAULT_ALGORITHMS), audience, issuer, secret }
    }

    protected extractBearerToken(request: any): string | undefined {
        const authorization = request.headers?.authorization
        if (!authorization) return undefined

        const [type, token] = authorization.split(' ')
        return type === 'Bearer' ? token : undefined
    }
}

@Injectable()
export abstract class OptionalJwtAuthGuard extends JwtAuthGuard {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        if (this.isPublicRoute(context)) {
            return true
        }

        const request = context.switchToHttp().getRequest()
        const token = this.extractBearerToken(request)

        if (!token) {
            request.user = null
            return true
        }

        try {
            const payload = await this.jwtService.verifyAsync(token, this.verifyOptions())
            request.user = payload
        } catch {
            request.user = null
        }

        return true
    }
}
