import { Injectable } from '@nestjs/common'
import { compare, hash } from 'bcrypt'
import { InjectJwtAuth, JwtAuthService } from 'common'
import { CustomersRepository } from '../customers.repository'
import { CustomerAuthPayload, CustomerCredentials } from '../dtos'

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

    async findCustomerByCredentials({ email, password }: CustomerCredentials) {
        const customer = await this.repository.findByEmailWithPassword(email)

        if (customer) {
            const isValid = await this.validate(password, customer.password)

            if (isValid) {
                return customer
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
