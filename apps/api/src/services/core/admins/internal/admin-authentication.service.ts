import { InjectJwtAuth, JwtAuthService } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { compare, hash, hashSync } from 'bcrypt'
import { AppConfigService } from 'config'
import { AdminsRepository } from '../admins.repository'
import { AdminAuthPayload, AdminCredentialsDto } from '../dtos'

// JwtAuthModule 등록 시 동일한 name으로 이 토큰과 묶는다.
export const ADMIN_JWT_AUTH_NAME = 'admins'

// root는 DB 도큐먼트 없이 env 자격증명으로 인증되며 admin CRUD 권한만 가진다.
// 콘텐츠 endpoint는 일반 admin(DB 도큐먼트)만 통과한다.
export const ROOT_EMAIL = 'root'
export const ROOT_SUB = 'root'

const BCRYPT_SALT_ROUNDS = 10
const TIMING_DUMMY_HASH = hashSync('timing-equalization-only', BCRYPT_SALT_ROUNDS)

@Injectable()
export class AdminAuthenticationService {
    private readonly rootPasswordHash: string

    constructor(
        private readonly repository: AdminsRepository,
        @InjectJwtAuth(ADMIN_JWT_AUTH_NAME) private readonly jwtAuthService: JwtAuthService,
        config: AppConfigService
    ) {
        // 부팅 시 한 번 hash로 변환해 두면 매 로그인마다 bcrypt.compare를 그대로 쓸 수 있어
        // 일반 admin 경로와 timing 특성이 같다.
        this.rootPasswordHash = hashSync(config.root.password, BCRYPT_SALT_ROUNDS)
    }

    async findAdminByCredentials({ email, password }: AdminCredentialsDto) {
        const admin = await this.repository.findByEmailWithPassword(email)
        const targetHash = admin?.password ?? TIMING_DUMMY_HASH

        const isValid = await this.validate(password, targetHash)

        return admin && isValid ? admin : null
    }

    async validateRoot(password: string) {
        return this.validate(password, this.rootPasswordHash)
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

    async revokeRefreshToken(refreshToken: string): Promise<void> {
        await this.jwtAuthService.revokeRefreshToken(refreshToken)
    }

    async validate(rawPassword: string, hashedPassword: string) {
        return compare(rawPassword, hashedPassword)
    }
}
