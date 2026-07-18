import { JwtAuthService, InjectJwtAuth } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { compare, hash, hashSync } from 'bcrypt'
import { UserAuthPayload, UserCredentialsDto } from '../dtos'
import { UsersRepository } from '../users.repository'

// OWASP 권장 비용 계수다.
const BCRYPT_SALT_ROUNDS = 10

// 없는 이메일도 bcrypt를 거쳐 가입 여부가 응답 시간으로 드러나지 않게 한다.
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
