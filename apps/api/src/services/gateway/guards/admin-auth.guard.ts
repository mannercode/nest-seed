import { AuthGuard } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { AppConfigService } from 'config'
import { AuthErrors } from './errors'

@Injectable()
export class AdminAuthGuard extends AuthGuard {
    constructor(jwtService: JwtService, reflector: Reflector, config: AppConfigService) {
        super(jwtService, reflector, {
            bearer: {
                audience: config.adminAuth.audience,
                issuer: config.adminAuth.issuer,
                secret: config.adminAuth.accessSecret
            },
            errorBody: AuthErrors.Unauthorized()
        })
    }
}
