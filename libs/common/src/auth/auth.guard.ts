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

export type BasicAuthOptions = {
    validate: (username: string, password: string) => Promise<unknown>
}

export type AuthGuardOptions = {
    /** 설정하면 `Authorization: Bearer ...` JWT를 검증한다. */
    bearer?: BearerAuthOptions
    /** 설정하면 `Authorization: Basic ...` 자격증명을 검증한다. */
    basic?: BasicAuthOptions
    /** true이면 `Authorization` 헤더가 없을 때도 통과시키고 `req.user`를 null로 둔다. */
    optional?: boolean
    /**
     * 인증 실패 시 `UnauthorizedException`에 담을 응답 본문이다.
     * 미지정 시 NestJS 기본 응답을 사용한다(`{ statusCode: 401, message: 'Unauthorized' }`).
     * 앱마다 통일된 에러 코드(`ERR_AUTH_UNAUTHORIZED` 등)를 쓰려면 여기에 지정한다.
     */
    errorBody?: string | object
}

// 설정된 Bearer/Basic 방식만 허용하고 optional 라우트는 헤더가 없을 때 user=null로 통과시킨다.
@Injectable()
export abstract class AuthGuard implements CanActivate {
    constructor(
        protected readonly jwtService: JwtService,
        protected readonly reflector: Reflector,
        protected readonly options: AuthGuardOptions
    ) {
        // 모든 요청이 401이 되는 설정 오류를 부팅 시점에 드러낸다.
        if (!options.bearer && !options.basic) {
            throw new Error('AuthGuard requires at least one of `bearer` or `basic` options')
        }
    }

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

        // Basic(RFC 7617)과 Bearer(RFC 6750)는 스킴 뒤에 공백과 자격증명 값을 요구한다.
        // 이 두 형식에 필요한 공백이 없으면 지원하는 인증값으로 해석하지 않는다.
        const sep = authorization.indexOf(' ')
        if (sep === -1) {
            throw new UnauthorizedException(this.options.errorBody)
        }
        const scheme = authorization.slice(0, sep)
        const value = authorization.slice(sep + 1).trim()

        // RFC 9110 §11.1에 따라 인증 스킴 이름은 대소문자를 구분하지 않는다.
        const lower = scheme.toLowerCase()

        const { bearer, basic } = this.options
        if (lower === 'bearer' && bearer) {
            request.user = await this.verifyBearer(value, bearer)
            return true
        }
        if (lower === 'basic' && basic) {
            request.user = await this.verifyBasic(value, basic)
            return true
        }
        throw new UnauthorizedException(this.options.errorBody)
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

    protected async verifyBasic(value: string, basic: BasicAuthOptions): Promise<unknown> {
        const decoded = Buffer.from(value, 'base64').toString('utf-8')
        // password에 ':'가 포함될 수 있으므로 첫 번째 ':'만 분리한다.
        const idx = decoded.indexOf(':')
        if (idx === -1) throw new UnauthorizedException(this.options.errorBody)

        const username = decoded.slice(0, idx)
        const password = decoded.slice(idx + 1)

        const user = await basic.validate(username, password)
        if (!user) throw new UnauthorizedException(this.options.errorBody)
        return user
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
