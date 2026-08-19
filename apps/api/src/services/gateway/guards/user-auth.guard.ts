import { AuthGuard } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { AppConfigService } from 'config'
import { UsersService } from 'core'
import { AuthErrors } from './errors'

@Injectable()
export class UserAuthGuard extends AuthGuard {
    constructor(
        jwtService: JwtService,
        reflector: Reflector,
        config: AppConfigService,
        usersService: UsersService
    ) {
        super(jwtService, reflector, {
            bearer: {
                audience: config.auth.audience,
                issuer: config.auth.issuer,
                secret: config.auth.accessSecret,
                validate: (payload) => usersService.isAuthPayloadActive(payload)
            },
            errorBody: AuthErrors.Unauthorized()
        })
    }
}
