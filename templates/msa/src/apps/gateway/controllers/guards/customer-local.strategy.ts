import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { CustomerAuthPayload, CustomersClient } from 'apps/cores'
import { Strategy } from 'passport-local'

@Injectable()
export class CustomerLocalStrategy extends PassportStrategy(Strategy, 'customer-local') {
    constructor(private readonly customersClient: CustomersClient) {
        super({ passwordField: 'password', usernameField: 'email' })
    }

    async validate(email: string, password: string): Promise<CustomerAuthPayload | null> {
        const customer = await this.customersClient.findCustomerByCredentials({ email, password })

        return customer ? { customerId: customer.id, email } : null
    }
}
