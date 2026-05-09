import { OptionalJwtAuthGuard } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { AppConfigService } from 'shared'

@Injectable()
export class UserOptionalJwtAuthGuard extends OptionalJwtAuthGuard {
    constructor(jwtService: JwtService, reflector: Reflector, config: AppConfigService) {
        super(jwtService, reflector, {
            audience: config.auth.audience,
            issuer: config.auth.issuer,
            secret: config.auth.accessSecret
        })
    }
}
