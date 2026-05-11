import { JwtAuthService, InjectJwtAuth } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { compare, hash, hashSync } from 'bcrypt'
import { UserAuthPayload, UserCredentialsDto } from '../dtos'
import { UsersRepository } from '../users.repository'

// bcrypt 비용 계수. OWASP 권장 기본값을 그대로 사용합니다. 환경마다 다르게 설정할
// 값이 아니라서 `.env`가 아닌 코드 상수로 둡니다.
const BCRYPT_SALT_ROUNDS = 10

/**
 * 가입된 이메일과 가입되지 않은 이메일에 대한 응답 시간이 달라지면, 공격자가
 * 그 차이로 가입 여부를 알아냅니다. 이를 막기 위해 미리 계산해 둔 더미 해시입니다.
 * 사용자를 찾지 못한 경우에도 이 해시로 bcrypt를 한 번 실행해서 응답 시간을
 * 평탄화합니다.
 */
const TIMING_DUMMY_HASH = hashSync('timing-equalization-only', BCRYPT_SALT_ROUNDS)

@Injectable()
export class UserAuthenticationService {
    constructor(
        private readonly repository: UsersRepository,
        @InjectJwtAuth() private readonly jwtAuthService: JwtAuthService
    ) {}

    async findUserByCredentials({ email, password }: UserCredentialsDto) {
        const user = await this.repository.findByEmailWithPassword(email)
        const targetHash = user?.password ?? TIMING_DUMMY_HASH

        const isValid = await this.validate(password, targetHash)

        return user && isValid ? user : null
    }

    async generateAuthTokens(payload: UserAuthPayload) {
        return this.jwtAuthService.generateAuthTokens(payload)
    }

    async hash(rawPassword: string) {
        return hash(rawPassword, BCRYPT_SALT_ROUNDS)
    }

    async refreshAuthTokens(refreshToken: string) {
        return this.jwtAuthService.refreshAuthTokens(refreshToken)
    }

    async revokeAllForUser(userId: string): Promise<void> {
        await this.jwtAuthService.revokeAllForUser(userId)
    }

    async revokeRefreshToken(refreshToken: string): Promise<void> {
        await this.jwtAuthService.revokeRefreshToken(refreshToken)
    }

    async validate(rawPassword: string, hashedPassword: string) {
        return compare(rawPassword, hashedPassword)
    }
}
