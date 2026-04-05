import { LocalAuthGuard } from '@mannercode/common'
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { CustomersService } from 'cores'
import { AuthErrors } from './errors'

@Injectable()
export class CustomerLocalAuthGuard extends LocalAuthGuard {
    constructor(private readonly customersService: CustomersService) {
        super({
            passwordField: 'password',
            usernameField: 'email',
            validate: async (email: string, password: string) => {
                const customer = await this.customersService.findCustomerByCredentials({
                    email,
                    password
                })

                if (!customer) {
                    throw new UnauthorizedException(AuthErrors.Unauthorized())
                }

                return { customerId: customer.id, email }
            }
        })
    }
}
