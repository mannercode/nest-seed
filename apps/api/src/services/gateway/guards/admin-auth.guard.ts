import { AuthGuard, JwtVerifier } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AppConfigService } from '#config'
import { AdminsService } from '#core'
import { AuthErrors } from './errors.js'

@Injectable()
export class AdminAuthGuard extends AuthGuard {
    constructor(
        jwtVerifier: JwtVerifier,
        reflector: Reflector,
        config: AppConfigService,
        adminsService: AdminsService
    ) {
        super(jwtVerifier, reflector, {
            bearer: {
                audience: config.adminAuth.audience,
                issuer: config.adminAuth.issuer,
                secret: config.adminAuth.accessSecret,
                validate: (payload) => adminsService.isAuthPayloadActive(payload)
            },
            errorBody: AuthErrors.Unauthorized()
        })
    }
}
