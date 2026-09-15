import { JwtAuthService, InjectJwtAuth, PasswordHasher } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import type { UserAuthPayload, UserCredentialsDto } from '../dtos/index.js'
import { UsersRepository } from '../users.repository.js'

@Injectable()
export class UserAuthenticationService {
    constructor(
        private readonly repository: UsersRepository,
        @InjectJwtAuth() private readonly jwtAuthService: JwtAuthService
    ) {}

    async authenticate({ email, password }: UserCredentialsDto) {
        const user = await this.repository.findForAuthentication({ email })
        const targetHash = user?.password

        const isValid = await this.validate(password, targetHash)

        return user && isValid ? user : null
    }

    async generateAuthTokens(payload: UserAuthPayload) {
        return this.jwtAuthService.generateAuthTokens(payload)
    }

    async hash(rawPassword: string) {
        return PasswordHasher.hash(rawPassword)
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

    async validate(rawPassword: string, hashedPassword: string | undefined) {
        return PasswordHasher.verify(rawPassword, hashedPassword)
    }
}
