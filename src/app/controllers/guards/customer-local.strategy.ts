import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy } from 'passport-local'
import { CustomersService } from 'services/cores'

@Injectable()
export class CustomerLocalStrategy extends PassportStrategy(Strategy, 'customer-local') {
    constructor(private service: CustomersService) {
        super({
            usernameField: 'email',
            passwordField: 'password'
        })
    }

    async validate(email: string, password: string) {
        const userId = await this.service.authenticateCustomer(email, password)

        return userId ? { userId, email } : null
    }
}
