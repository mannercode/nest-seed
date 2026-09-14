import { JwtAuthService, InjectJwtAuth, PasswordHasher } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import {
    type UserAuthPayload,
    UserAuthPayloadSchema,
    type UserCredentialsDto
} from '../dtos/index.js'
import { UsersRepository } from '../users.repository.js'

@Injectable()
export class UserAuthenticationService {
    constructor(
        private readonly repository: UsersRepository,
        @InjectJwtAuth() private readonly jwtAuthService: JwtAuthService
    ) {}

    async findUserByCredentials({ email, password }: UserCredentialsDto) {
        const user = await this.repository.findByEmailWithPassword(email)
        const targetHash = user?.password

        const isValid = await this.validate(password, targetHash)

        return user && isValid ? user : null
    }

    async generateAuthTokens(payload: UserAuthPayload) {
        return this.jwtAuthService.generateAuthTokens(payload, undefined, (candidate) =>
            this.isAuthPayloadActive(candidate)
        )
    }

    async hash(rawPassword: string) {
        return PasswordHasher.hash(rawPassword)
    }

    async refreshAuthTokens(refreshToken: string) {
        return this.jwtAuthService.refreshAuthTokens(refreshToken, undefined, (payload) =>
            this.isAuthPayloadActive(payload)
        )
    }

    async revokeAllForUser(userId: string): Promise<void> {
        await this.jwtAuthService.revokeAllForUser(userId)
    }

    async revokeRefreshToken(refreshToken: string): Promise<void> {
        await this.jwtAuthService.revokeRefreshToken(refreshToken)
    }

    async validate(rawPassword: string, hashedPassword: string | undefined) {
        return PasswordHasher.verify(rawPassword, hashedPassword)
    }

    async isAuthPayloadActive(payload: unknown): Promise<boolean> {
        const result = UserAuthPayloadSchema.safeParse(payload)
        if (!result.success) return false

        const candidate = result.data
        return this.repository.isAuthVersionCurrent(candidate.sub, candidate.authVersion)
    }
}
