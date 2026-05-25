import { LocalAuthGuard } from '@mannercode/common'
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { AdminsService, ROOT_EMAIL, ROOT_SUB } from 'core'
import { AuthErrors } from './errors'

// admin 로그인은 별도의 LocalAuthGuard 인스턴스로 처리한다.
// user의 LocalStrategy와 충돌하지 않도록 LocalAuthGuard가 인스턴스마다 고유 전략을 등록하는 점에 의존한다.
//
// `email`이 ROOT_EMAIL('root')이면 env 자격증명으로 인증해 `sub=ROOT_SUB`를 발급한다.
// 일반 admin은 DB 조회 후 `sub=admin.id`. RootAuthGuard / AdminAuthGuard가 이 sub 값으로 권한을 분리한다.
@Injectable()
export class AdminLocalAuthGuard extends LocalAuthGuard {
    constructor(private readonly adminsService: AdminsService) {
        super({
            passwordField: 'password',
            usernameField: 'email',
            validate: async (email: string, password: string) => {
                if (email === ROOT_EMAIL) {
                    const ok = await this.adminsService.validateRoot(password)
                    if (!ok) {
                        throw new UnauthorizedException(AuthErrors.Unauthorized())
                    }
                    return { sub: ROOT_SUB, email: ROOT_EMAIL }
                }

                const admin = await this.adminsService.findAdminByCredentials({ email, password })

                if (!admin) {
                    throw new UnauthorizedException(AuthErrors.Unauthorized())
                }

                return { sub: admin.id, email }
            }
        })
    }
}
