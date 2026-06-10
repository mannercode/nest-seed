import { InjectJwtAuth, JwtAuthService } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { compare, hash, hashSync } from 'bcrypt'
import { AdminsRepository } from '../admins.repository'
import { AdminAuthPayload, AdminCredentialsDto } from '../dtos'

// JwtAuthModule 등록 시 동일한 name으로 이 토큰과 묶는다.
export const ADMIN_JWT_AUTH_NAME = 'admins'

const BCRYPT_SALT_ROUNDS = 10
const TIMING_DUMMY_HASH = hashSync('timing-equalization-only', BCRYPT_SALT_ROUNDS)

@Injectable()
export class AdminAuthenticationService {
    constructor(
        private readonly repository: AdminsRepository,
        @InjectJwtAuth(ADMIN_JWT_AUTH_NAME) private readonly jwtAuthService: JwtAuthService
    ) {}

    async findAdminByCredentials({ email, password }: AdminCredentialsDto) {
        const admin = await this.repository.findByEmailWithPassword(email)
        const targetHash = admin?.password ?? TIMING_DUMMY_HASH

        const isValid = await this.validate(password, targetHash)

        return admin && isValid ? admin : null
    }

    async generateAuthTokens(payload: AdminAuthPayload) {
        return this.jwtAuthService.generateAuthTokens(payload)
    }

    async hash(rawPassword: string) {
        return hash(rawPassword, BCRYPT_SALT_ROUNDS)
    }

    async refreshAuthTokens(refreshToken: string) {
        return this.jwtAuthService.refreshAuthTokens(refreshToken)
    }

    async revokeAllForAdmin(adminId: string): Promise<void> {
        await this.jwtAuthService.revokeAllForUser(adminId)
    }

    async revokeRefreshToken(refreshToken: string): Promise<void> {
        await this.jwtAuthService.revokeRefreshToken(refreshToken)
    }

    async validate(rawPassword: string, hashedPassword: string) {
        return compare(rawPassword, hashedPassword)
    }
}
