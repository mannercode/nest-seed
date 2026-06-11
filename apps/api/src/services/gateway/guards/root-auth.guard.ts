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
        // 부팅 시 한 번만 해시한다.
        // 매 요청마다 같은 해시로 bcrypt.compare를 돌려 정답/오답 응답 시간이 일관된다.
        const passwordHash = hashSync(config.root.password, 10)
        super(jwtService, reflector, {
            basic: {
                validate: async (username, password) => {
                    // username 일치 여부와 무관하게 bcrypt를 돌려 응답 시간을 평탄화한다.
                    // username으로 분기하면 "유저가 root인지" 여부를 타이밍으로 흘릴 수 있다.
                    const ok = await compare(password, passwordHash)
                    return ok && username === RootAuthGuard.USERNAME ? { kind: 'root' } : null
                }
            },
            errorBody: AuthErrors.Unauthorized()
        })
    }
}
