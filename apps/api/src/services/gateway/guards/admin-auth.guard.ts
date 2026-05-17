import { defaultTo, JwtAuthGuard } from '@mannercode/common'
import { ExecutionContext, Injectable } from '@nestjs/common'
import { GUARDS_METADATA } from '@nestjs/common/constants'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { AppConfigService } from 'config'
import { AdminLocalAuthGuard } from './admin-local-auth.guard'

@Injectable()
export class AdminAuthGuard extends JwtAuthGuard {
    constructor(jwtService: JwtService, reflector: Reflector, config: AppConfigService) {
        super(jwtService, reflector, {
            audience: config.adminAuth.audience,
            issuer: config.adminAuth.issuer,
            secret: config.adminAuth.accessSecret
        })
    }

    protected isUsingLocalAuth(context: ExecutionContext): boolean {
        const handler = context.getHandler()
        const classRef = context.getClass()
        const guards =
            this.reflector.get<any[] | null>(GUARDS_METADATA, handler) ??
            this.reflector.get<any[] | null>(GUARDS_METADATA, classRef)

        return defaultTo(guards, []).some((guard) => guard === AdminLocalAuthGuard)
    }
}
