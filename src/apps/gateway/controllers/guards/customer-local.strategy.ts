import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { CustomerAuthPayload, CustomersClient } from 'apps/cores'
import { Strategy } from 'passport-local'

@Injectable()
export class CustomerLocalStrategy extends PassportStrategy(Strategy, 'customer-local') {
    constructor(private readonly customersService: CustomersClient) {
        super({ usernameField: 'email', passwordField: 'password' })
    }

    async validate(email: string, password: string): Promise<CustomerAuthPayload | null> {
        const customer = await this.customersService.findCustomerByCredentials({ email, password })

        return customer ? { customerId: customer.id, email } : null
    }
}
