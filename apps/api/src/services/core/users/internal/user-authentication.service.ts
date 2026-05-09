import { JwtAuthService, InjectJwtAuth } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { compare, hash, hashSync } from 'bcrypt'
import { UserAuthPayload, UserCredentialsDto } from '../dtos'
import { UsersRepository } from '../users.repository'

// bcrypt 비용 계수. 10 은 OWASP 권장 기본값. 환경마다 조정할 값이 아니라
// .env 가 아닌 코드 상수로 둔다.
const BCRYPT_SALT_ROUNDS = 10

/**
 * 가입된 이메일과 미가입 이메일의 응답 시간 차이로 계정 열거가 가능해지는 것을 막기 위한
 * 사전 계산 더미 해시. user 가 없을 때도 한 번은 bcrypt 를 돌려 시간을 평탄화한다.
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
