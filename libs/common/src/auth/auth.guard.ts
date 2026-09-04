import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { IS_OPTIONAL_AUTH_KEY } from './optional-auth.decorator.js'
import { IS_PUBLIC_KEY } from './public.decorator.js'

// 발급 측과 함께 고정해 none/HS↔RS 알고리즘 혼동을 막는다.
const ACCEPTED_ALGORITHMS = ['HS256'] as const

export type BearerAuthOptions = {
    /** 설정하면 `aud` 클레임이 필수가 되고, 값이 다른 토큰은 거절한다. */
    audience?: string
    /** 설정하면 `iss` 클레임이 필수가 되고, 값이 다른 토큰은 거절한다. */
    issuer?: string
    secret: string
    /**
     * 서명 검증 뒤 애플리케이션의 현재 계정 상태까지 확인한다.
     * 계정 삭제나 세션 버전 변경처럼 JWT 자체만으로 알 수 없는 철회 상태에 사용한다.
     */
    validate?: (payload: unknown) => Promise<boolean>
}

export type AuthGuardOptions = {
    bearer: BearerAuthOptions
    /** true이면 `Authorization` 헤더가 없을 때도 통과시키고 `req.user`를 null로 둔다. */
    optional?: boolean
    /**
     * 인증 실패 시 `UnauthorizedException`에 담을 응답 본문이다.
     * 미지정 시 NestJS 기본 응답을 사용한다(`{ statusCode: 401, message: 'Unauthorized' }`).
     * 앱마다 통일된 에러 코드(`ERR_AUTH_UNAUTHORIZED` 등)를 쓰려면 여기에 지정한다.
     */
    errorBody?: string | object
}

@Injectable()
export abstract class AuthGuard implements CanActivate {
    constructor(
        protected readonly jwtService: JwtService,
        protected readonly reflector: Reflector,
        protected readonly options: AuthGuardOptions
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        if (this.isPublicRoute(context)) return true

        const request = context.switchToHttp().getRequest()
        const authorization: string | undefined = request.headers.authorization

        if (!authorization) {
            if (this.options.optional || this.isOptionalRoute(context)) {
                request.user = null
                return true
            }
            throw new UnauthorizedException(this.options.errorBody)
        }

        const sep = authorization.indexOf(' ')
        if (sep === -1) {
            throw new UnauthorizedException(this.options.errorBody)
        }
        const scheme = authorization.slice(0, sep)
        const token = authorization.slice(sep + 1).trim()
        if (scheme.toLowerCase() !== 'bearer') {
            throw new UnauthorizedException(this.options.errorBody)
        }

        request.user = await this.verifyBearer(token, this.options.bearer)
        return true
    }

    // JWT 검증 오류는 종류를 노출하지 않고 같은 401 응답으로 매핑한다.
    protected async verifyBearer(token: string, bearer: BearerAuthOptions): Promise<unknown> {
        let payload: unknown
        try {
            payload = await this.jwtService.verifyAsync(token, {
                algorithms: [...ACCEPTED_ALGORITHMS],
                audience: bearer.audience,
                issuer: bearer.issuer,
                secret: bearer.secret
            })
        } catch {
            throw new UnauthorizedException(this.options.errorBody)
        }

        if (bearer.validate && !(await bearer.validate(payload))) {
            throw new UnauthorizedException(this.options.errorBody)
        }
        return payload
    }

    protected isPublicRoute(context: ExecutionContext): boolean {
        return this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass()
        ])
    }

    protected isOptionalRoute(context: ExecutionContext): boolean {
        return this.reflector.getAllAndOverride<boolean>(IS_OPTIONAL_AUTH_KEY, [
            context.getHandler(),
            context.getClass()
        ])
    }
}
