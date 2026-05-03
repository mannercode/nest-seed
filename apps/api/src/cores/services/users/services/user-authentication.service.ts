import { JwtAuthService, InjectJwtAuth } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { compare, hash } from 'bcrypt'
import { Rules } from 'config'
import { UserAuthPayload, UserCredentialsDto } from '../dtos'
import { UsersRepository } from '../users.repository'

@Injectable()
export class UserAuthenticationService {
    constructor(
        private readonly repository: UsersRepository,
        @InjectJwtAuth() private readonly jwtAuthService: JwtAuthService
    ) {}

    async findUserByCredentials({ email, password }: UserCredentialsDto) {
        const user = await this.repository.findByEmailWithPassword(email)

        if (user) {
            const isValid = await this.validate(password, user.password)

            if (isValid) {
                return user
            }
        }

        return null
    }

    async generateAuthTokens(payload: UserAuthPayload) {
        return this.jwtAuthService.generateAuthTokens(payload)
    }

    async hash(rawPassword: string) {
        return hash(rawPassword, Rules.Auth.bcryptSaltRounds)
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
