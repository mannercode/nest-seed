import { JwtAuthGuard } from '@mannercode/common'
import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { AppConfigService } from 'config'
import { ROOT_SUB } from 'core'
import { AuthErrors } from './errors'

// root 전용 가드. 일반 admin은 거부한다. `POST /admins` 같은 admin CRUD endpoint에 사용한다.
// 토큰 검증은 AdminAuthGuard와 같은 secret/audience를 쓴다(같은 JWT 신뢰 영역).
@Injectable()
export class RootAuthGuard extends JwtAuthGuard {
    constructor(jwtService: JwtService, reflector: Reflector, config: AppConfigService) {
        super(jwtService, reflector, {
            audience: config.adminAuth.audience,
            issuer: config.adminAuth.issuer,
            secret: config.adminAuth.accessSecret
        })
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // super.canActivate는 통과 시 true, 실패 시 throw이므로 결과를 따로 분기할 필요가 없다.
        await super.canActivate(context)

        const request = context.switchToHttp().getRequest<{ user?: { sub?: string } }>()
        if (request.user?.sub !== ROOT_SUB) {
            throw new ForbiddenException(AuthErrors.Forbidden())
        }
        return true
    }

    protected isUsingLocalAuth(): boolean {
        return false
    }
}
