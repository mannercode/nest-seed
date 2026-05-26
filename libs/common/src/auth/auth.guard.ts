import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { IS_OPTIONAL_AUTH_KEY } from './optional-auth.decorator'
import { IS_PUBLIC_KEY } from './public.decorator'

// 서명 알고리즘은 JwtAuthService가 발급할 때와 동일하게 HS256으로 고정한다.
// 옵션으로 받지 않는 이유는 알고리즘 혼동 공격(`none`으로 바꾸기, HS↔RS 교체)을
// 막기 위함과, "기본값이 silent하게 채워지는" fallback을 만들지 않기 위함이다.
// RS256 등 다른 알고리즘을 쓰려면 이 상수와 JwtAuthService의 JWT_ALGORITHM을 함께 바꾼다.
const ACCEPTED_ALGORITHMS = ['HS256'] as const

export type BearerAuthOptions = {
    /** 필수 `aud` 클레임. 값이 맞지 않는 토큰은 거절한다. */
    audience?: string
    /** 필수 `iss` 클레임. 값이 맞지 않는 토큰은 거절한다. */
    issuer?: string
    secret: string
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

/**
 * `Authorization` 헤더 스킴(`Bearer`/`Basic`)을 보고 각 인증 방식을 디스패치한다.
 *
 * - `bearer`만 설정 → JWT 전용 가드
 * - `basic`만 설정 → 자격증명 가드 (Basic Auth)
 * - 둘 다 설정 → 한 엔드포인트에서 두 주체 모두 허용 (예: admin 영역에 root + admin)
 * - `optional: true` 또는 `@OptionalAuth()` → 헤더 없으면 `req.user=null`로 통과
 *
 * 스킴은 설정되어 있는데 헤더에 다른 스킴이 오면 401을 던진다.
 * 즉, 헤더가 있다면 반드시 설정된 스킴 중 하나여야 한다.
 */
@Injectable()
export abstract class AuthGuard implements CanActivate {
    constructor(
        protected readonly jwtService: JwtService,
        protected readonly reflector: Reflector,
        protected readonly options: AuthGuardOptions
    ) {
        // bearer/basic 둘 다 비어 있으면 모든 요청이 자동 401이 된다(silent misconfig).
        // 부팅 시 즉시 거절해서 잘못된 설정이 런타임까지 새지 않게 한다.
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

        // RFC 7235: 스킴과 값은 공백으로 구분된다. 공백이 없으면 형식 오류로 즉시 거절한다.
        const sep = authorization.indexOf(' ')
        if (sep === -1) {
            throw new UnauthorizedException(this.options.errorBody)
        }
        const scheme = authorization.slice(0, sep)
        const value = authorization.slice(sep + 1).trim()

        // RFC 7235에 따라 인증 스킴 비교는 대소문자를 가리지 않는다.
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

    // 만료는 정상 흐름의 일부라 사전 디코드로 잡아 401을 돌려준다.
    // 서명 위조/구조 깨짐 같은 비정상은 verifyAsync가 던지게 두어 위로 전파된다.
    // canActivate에서 공백 분리가 끝난 뒤에만 호출되므로 token은 비어 있을 수 없다.
    protected async verifyBearer(token: string, bearer: BearerAuthOptions): Promise<unknown> {
        const decoded = this.jwtService.decode<Record<string, unknown> | null>(token)
        const exp = decoded?.exp
        if (typeof exp === 'number' && exp < Date.now() / 1000) {
            throw new UnauthorizedException('token expired')
        }

        return this.jwtService.verifyAsync(token, {
            algorithms: [...ACCEPTED_ALGORITHMS],
            audience: bearer.audience,
            issuer: bearer.issuer,
            secret: bearer.secret
        })
    }

    protected async verifyBasic(value: string, basic: BasicAuthOptions): Promise<unknown> {
        // canActivate에서 공백 분리가 끝난 뒤에만 호출되므로 value는 비어 있을 수 없다.
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
