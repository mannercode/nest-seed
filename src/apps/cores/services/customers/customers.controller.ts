import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { CustomersService } from './customers.service'
import { CustomerCreateDto, CustomerQueryDto, CustomerUpdateDto } from './dtos'

@Controller()
export class CustomersController {
    constructor(private service: CustomersService) {}

    @MessagePattern('nestSeed.cores.customers.createCustomer')
    async createCustomer(@Payload() createDto: CustomerCreateDto) {
        return this.service.createCustomer(createDto)
    }

    @MessagePattern('nestSeed.cores.customers.updateCustomer')
    updateCustomer(
        @Payload('customerId') customerId: string,
        @Payload('updateDto') updateDto: CustomerUpdateDto
    ) {
        return this.service.updateCustomer(customerId, updateDto)
    }

    @MessagePattern('nestSeed.cores.customers.getCustomer')
    getCustomer(@Payload() customerId: string) {
        return this.service.getCustomer(customerId)
    }

    @MessagePattern('nestSeed.cores.customers.deleteCustomer')
    deleteCustomer(@Payload() customerId: string) {
        return this.service.deleteCustomer(customerId)
    }

    @MessagePattern('nestSeed.cores.customers.findCustomers')
    findCustomers(@Payload() queryDto: CustomerQueryDto) {
        return this.service.findCustomers(queryDto)
    }

    @MessagePattern('nestSeed.cores.customers.login')
    login(@Payload('userId') userId: string, @Payload('email') email: string) {
        return this.service.login(userId, email)
    }

    @MessagePattern('nestSeed.cores.customers.refreshAuthTokens')
    refreshAuthTokens(@Payload() refreshToken: string) {
        return this.service.refreshAuthTokens(refreshToken)
    }

    @MessagePattern('nestSeed.cores.customers.authenticateCustomer')
    authenticateCustomer(@Payload('email') email: string, @Payload('password') password: string) {
        return this.service.authenticateCustomer(email, password)
    }
}
