import { AuthGuard, JwtVerifier } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AppConfigService } from '#config'
import { UsersService } from '#core'
import { AuthErrors } from './errors.js'

@Injectable()
export class UserAuthGuard extends AuthGuard {
    constructor(
        jwtVerifier: JwtVerifier,
        reflector: Reflector,
        config: AppConfigService,
        usersService: UsersService
    ) {
        super(jwtVerifier, reflector, {
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
