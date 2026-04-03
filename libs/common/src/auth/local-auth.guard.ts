import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { defaultTo } from '../utils'

export type LocalAuthGuardOptions = {
    passwordField?: string
    usernameField?: string
    validate: (username: string, password: string) => Promise<object | null>
}

@Injectable()
export abstract class LocalAuthGuard implements CanActivate {
    constructor(protected readonly options: LocalAuthGuardOptions) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest()
        const usernameField = defaultTo(this.options.usernameField, 'username')
        const passwordField = defaultTo(this.options.passwordField, 'password')

        const username = request.body?.[usernameField]
        const password = request.body?.[passwordField]

        if (!username || !password) {
            throw new UnauthorizedException()
        }

        const user = await this.options.validate(username, password)

        if (!user) {
            throw new UnauthorizedException()
        }

        request.user = user
        return true
    }
}
