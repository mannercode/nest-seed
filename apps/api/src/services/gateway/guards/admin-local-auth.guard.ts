import { LocalAuthGuard } from '@mannercode/common'
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { AdminsService } from 'core'
import { AuthErrors } from './errors'

// admin 로그인은 별도의 LocalAuthGuard 인스턴스로 처리한다.
// user의 LocalStrategy와 충돌하지 않도록 LocalAuthGuard가 인스턴스마다 고유 전략을 등록하는 점에 의존한다.
@Injectable()
export class AdminLocalAuthGuard extends LocalAuthGuard {
    constructor(private readonly adminsService: AdminsService) {
        super({
            passwordField: 'password',
            usernameField: 'email',
            validate: async (email: string, password: string) => {
                const admin = await this.adminsService.findAdminByCredentials({ email, password })

                if (!admin) {
                    throw new UnauthorizedException(AuthErrors.Unauthorized())
                }

                return { sub: admin.id, email }
            }
        })
    }
}
