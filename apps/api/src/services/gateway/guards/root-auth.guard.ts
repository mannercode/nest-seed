import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { compare, hashSync } from 'bcrypt'
import { AppConfigService } from 'config'
import { AuthErrors } from './errors'

// root 전용 가드. JWT가 아닌 Basic Auth로 매 요청마다 env 자격증명을 검증한다.
// root는 DB 도큐먼트 없이 시스템 자격증명으로 admin CRUD 권한만 가진다.
// JWT를 발급하지 않으므로 token 만료·갱신·취소 같은 session 관리도 없다.
@Injectable()
export class RootAuthGuard implements CanActivate {
    private readonly rootPasswordHash: string

    constructor(config: AppConfigService) {
        // 부팅 시 한 번 hash로 변환해 두면 매 요청마다 bcrypt.compare를 그대로 쓸 수 있어
        // timing 특성이 일관된다.
        this.rootPasswordHash = hashSync(config.root.password, 10)
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<{ headers?: Record<string, string> }>()
        const auth = request.headers?.authorization

        if (!auth?.startsWith('Basic ')) {
            throw new UnauthorizedException(AuthErrors.Unauthorized())
        }

        const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf-8')
        // password에 ':'가 포함될 수 있으므로 첫 번째 ':'만 분리한다.
        const sepIdx = decoded.indexOf(':')
        const username = sepIdx === -1 ? decoded : decoded.slice(0, sepIdx)
        const password = sepIdx === -1 ? '' : decoded.slice(sepIdx + 1)

        if (username !== 'root') {
            throw new UnauthorizedException(AuthErrors.Unauthorized())
        }

        const ok = await compare(password, this.rootPasswordHash)
        if (!ok) {
            throw new UnauthorizedException(AuthErrors.Unauthorized())
        }

        return true
    }
}
