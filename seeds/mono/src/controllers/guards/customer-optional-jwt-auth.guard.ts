import { OptionalJwtAuthGuard } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { AppConfigService } from 'config'

@Injectable()
export class CustomerOptionalJwtAuthGuard extends OptionalJwtAuthGuard {
    constructor(jwtService: JwtService, reflector: Reflector, config: AppConfigService) {
        super(jwtService, reflector, { secret: config.auth.accessSecret })
    }
}
