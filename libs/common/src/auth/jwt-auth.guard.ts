import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService, JwtVerifyOptions } from '@nestjs/jwt'
import { defaultTo } from '../utils'
import { IS_PUBLIC_KEY } from './public.decorator'

const DEFAULT_ALGORITHMS: JwtVerifyOptions['algorithms'] = ['HS256']

export type JwtAuthGuardOptions = {
    /**
     * 허용할 서명 algorithm 목록. 기본값은 `['HS256']`. 고정해두면 JWT
     * algorithm-confusion 공격 (`none` 강제, HS↔RS 교체) 을 막는다.
     */
    algorithms?: JwtVerifyOptions['algorithms']
    /** 필수 `aud` claim. audience 가 다른 token 은 거부된다. */
    audience?: string
    /** 필수 `iss` claim. issuer 가 다른 token 은 거부된다. */
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

        // RFC 6750: scheme 비교는 case-insensitive ("Bearer" / "bearer" / "BEARER" 모두 허용).
        const [type, token] = authorization.split(' ')
        return type?.toLowerCase() === 'bearer' ? token : undefined
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
