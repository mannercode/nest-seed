import { LocalAuthGuard } from '@mannercode/common'
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { UsersService } from 'core'
import { AuthErrors } from './errors'

@Injectable()
export class UserLocalAuthGuard extends LocalAuthGuard {
    constructor(private readonly usersService: UsersService) {
        super({
            passwordField: 'password',
            usernameField: 'email',
            validate: async (email: string, password: string) => {
                const user = await this.usersService.findUserByCredentials({ email, password })

                if (!user) {
                    throw new UnauthorizedException(AuthErrors.Unauthorized())
                }

                return { sub: user.id, email }
            }
        })
    }
}
