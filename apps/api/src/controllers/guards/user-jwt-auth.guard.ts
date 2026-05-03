import { defaultTo, JwtAuthGuard } from '@mannercode/common'
import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { GUARDS_METADATA } from '@nestjs/common/constants'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { AppConfigService } from 'config'
import { AuthErrors } from './errors'
import { UserLocalAuthGuard } from './user-local-auth.guard'

@Injectable()
export class UserJwtAuthGuard extends JwtAuthGuard {
    constructor(jwtService: JwtService, reflector: Reflector, config: AppConfigService) {
        super(jwtService, reflector, { secret: config.auth.accessSecret })
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        try {
            return await super.canActivate(context)
        } catch {
            throw new UnauthorizedException(AuthErrors.Unauthorized())
        }
    }

    protected isUsingLocalAuth(context: ExecutionContext): boolean {
        const handler = context.getHandler()
        const classRef = context.getClass()
        const guards =
            this.reflector.get<any[] | null>(GUARDS_METADATA, handler) ??
            this.reflector.get<any[] | null>(GUARDS_METADATA, classRef)

        return defaultTo(guards, []).some((guard) => guard === UserLocalAuthGuard)
    }
}
