import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { CustomerAuthPayload, CustomersService } from 'cores'
import { Strategy } from 'passport-local'

@Injectable()
export class CustomerLocalStrategy extends PassportStrategy(Strategy, 'customer-local') {
    constructor(private readonly customersService: CustomersService) {
        super({ passwordField: 'password', usernameField: 'email' })
    }

    async validate(email: string, password: string): Promise<CustomerAuthPayload | null> {
        const customer = await this.customersService.findCustomerByCredentials({ email, password })

        return customer ? { customerId: customer.id, email } : null
    }
}
