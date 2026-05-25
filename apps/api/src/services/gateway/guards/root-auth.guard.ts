import { AuthGuard } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { compare, hashSync } from 'bcrypt'
import { AppConfigService } from 'config'
import { AuthErrors } from './errors'

// root는 DB 도큐먼트 없이 환경 자격증명으로 인증한다.
// `Authorization: Basic` 헤더로 매 요청마다 검증하고, JWT를 발급하지 않으므로
// 토큰 만료·갱신·취소 같은 세션 관리도 없다.
@Injectable()
export class RootAuthGuard extends AuthGuard {
    private static readonly USERNAME = 'root'

    constructor(jwtService: JwtService, reflector: Reflector, config: AppConfigService) {
        // 부팅 시 한 번 hash로 변환해 두면 매 요청마다 bcrypt.compare를 그대로 쓸 수 있어
        // 정답/오답 응답 시간이 일관된다.
        const passwordHash = hashSync(config.root.password, 10)
        super(jwtService, reflector, {
            basic: {
                validate: async (username, password) => {
                    if (username !== RootAuthGuard.USERNAME) return null
                    const ok = await compare(password, passwordHash)
                    return ok ? { kind: 'root' } : null
                }
            },
            errorBody: AuthErrors.Unauthorized()
        })
    }
}
