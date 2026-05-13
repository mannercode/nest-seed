import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService, JwtVerifyOptions } from '@nestjs/jwt'
import { defaultTo } from '../utils'
import { IS_PUBLIC_KEY } from './public.decorator'

const DEFAULT_ALGORITHMS: JwtVerifyOptions['algorithms'] = ['HS256']

export type JwtAuthGuardOptions = {
    /**
     * 허용할 서명 알고리즘 목록. 기본값은 `['HS256']`. 고정해 두면 알고리즘
     * 혼동 공격(`none`으로 바꾸기, HS↔RS 교체)을 막습니다.
     */
    algorithms?: JwtVerifyOptions['algorithms']
    /** 필수 `aud` 클레임. 값이 맞지 않는 토큰은 거절합니다. */
    audience?: string
    /** 필수 `iss` 클레임. 값이 맞지 않는 토큰은 거절합니다. */
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

        const payload = await this.jwtService.verifyAsync(token, this.verifyOptions())
        request.user = payload

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

        // RFC 6750에 따라 인증 스킴 비교는 대소문자를 가리지 않습니다.
        // "Bearer", "bearer", "BEARER" 모두 받아들입니다.
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
