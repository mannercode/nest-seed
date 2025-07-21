import { Injectable } from '@nestjs/common'
import { compare, hash } from 'bcrypt'
import { InjectJwtAuth, JwtAuthService } from 'common'
import { CustomersRepository } from '../customers.repository'
import { CustomerAuthPayload } from '../dtos'

@Injectable()
export class CustomerAuthenticationService {
    constructor(
        private repository: CustomersRepository,
        @InjectJwtAuth() private jwtAuthService: JwtAuthService
    ) {}

    async generateAuthTokens(payload: CustomerAuthPayload) {
        return this.jwtAuthService.generateAuthTokens(payload)
    }

    async refreshAuthTokens(refreshToken: string) {
        return this.jwtAuthService.refreshAuthTokens(refreshToken)
    }

    async authenticateByEmail(email: string, rawPassword: string): Promise<string | null> {
        const customer = await this.repository.findByEmailWithPassword(email)

        if (customer) {
            const isValid = await this.validate(rawPassword, customer.password)

            if (isValid) {
                return customer.id
            }
        }

        return null
    }

    async hash(rawPassword: string) {
        const saltRounds = 10

        const hashedPassword = await hash(rawPassword, saltRounds)
        return hashedPassword
    }

    async validate(rawPassword: string, hashedPassword: string) {
        return compare(rawPassword, hashedPassword)
    }
}
