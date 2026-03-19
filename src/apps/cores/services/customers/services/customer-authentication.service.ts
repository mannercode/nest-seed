import { JwtAuthService } from '@mannercode/nest-common'
import { InjectJwtAuth } from '@mannercode/nest-common'
import { Injectable } from '@nestjs/common'
import { compare, hash } from 'bcrypt'
import { CustomersRepository } from '../customers.repository'
import { CustomerAuthPayload, CustomerCredentialsDto } from '../dtos'

@Injectable()
export class CustomerAuthenticationService {
    constructor(
        private readonly repository: CustomersRepository,
        @InjectJwtAuth() private readonly jwtAuthService: JwtAuthService
    ) {}

    async findCustomerByCredentials({ email, password }: CustomerCredentialsDto) {
        const customer = await this.repository.findByEmailWithPassword(email)

        if (customer) {
            const isValid = await this.validate(password, customer.password)

            if (isValid) {
                return customer
            }
        }

        return null
    }

    async generateAuthTokens(payload: CustomerAuthPayload) {
        return this.jwtAuthService.generateAuthTokens(payload)
    }

    async hash(rawPassword: string) {
        const saltRounds = 10

        const hashedPassword = await hash(rawPassword, saltRounds)
        return hashedPassword
    }

    async refreshAuthTokens(refreshToken: string) {
        return this.jwtAuthService.refreshAuthTokens(refreshToken)
    }

    async validate(rawPassword: string, hashedPassword: string) {
        return compare(rawPassword, hashedPassword)
    }
}
