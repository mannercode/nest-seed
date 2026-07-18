import { AuthGuard } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { compare, hashSync } from 'bcrypt'
import { AppConfigService } from 'config'
import { AuthErrors } from './errors'

// root는 DB와 세션 없이 환경 자격증명을 Basic Auth로 검증한다.
@Injectable()
export class RootAuthGuard extends AuthGuard {
    private static readonly USERNAME = 'root'

    constructor(jwtService: JwtService, reflector: Reflector, config: AppConfigService) {
        // 같은 해시로 매번 비교해 정답과 오답의 응답 시간을 평탄화한다.
        const passwordHash = hashSync(config.root.password, 10)
        super(jwtService, reflector, {
            basic: {
                validate: async (username, password) => {
                    // username이 틀려도 bcrypt를 실행해 타이밍 차이를 숨긴다.
                    const ok = await compare(password, passwordHash)
                    return ok && username === RootAuthGuard.USERNAME ? { kind: 'root' } : null
                }
            },
            errorBody: AuthErrors.Unauthorized()
        })
    }
}
