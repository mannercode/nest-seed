import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { CustomersService } from './customers.service'
import { CustomerCreateDto, CustomerQueryDto, CustomerUpdateDto } from './dtos'

@Controller()
export class CustomersController {
    constructor(private service: CustomersService) {}

    @MessagePattern('cores.customers.createCustomer')
    async createCustomer(@Payload() createDto: CustomerCreateDto) {
        const dto = await this.service.createCustomer(createDto)
        return Object.assign({}, dto)
        // return dto
    }

    @MessagePattern('cores.customers.updateCustomer')
    updateCustomer(
        @Payload('customerId') customerId: string,
        @Payload('updateDto') updateDto: CustomerUpdateDto
    ) {
        return this.service.updateCustomer(customerId, updateDto)
    }

    @MessagePattern('cores.customers.getCustomer')
    getCustomer(@Payload() customerId: string) {
        return this.service.getCustomer(customerId)
    }

    @MessagePattern('cores.customers.deleteCustomer')
    deleteCustomer(@Payload() customerId: string) {
        return this.service.deleteCustomer(customerId)
    }

    @MessagePattern('cores.customers.findCustomers')
    findCustomers(@Payload() queryDto: CustomerQueryDto) {
        return this.service.findCustomers(queryDto)
    }

    @MessagePattern('cores.customers.login')
    login(@Payload('userId') userId: string, @Payload('email') email: string) {
        return this.service.login(userId, email)
    }

    @MessagePattern('cores.customers.refreshAuthTokens')
    refreshAuthTokens(@Payload() refreshToken: string) {
        return this.service.refreshAuthTokens(refreshToken)
    }

    @MessagePattern('cores.customers.authenticateCustomer')
    authenticateCustomer(@Payload('email') email: string, @Payload('password') password: string) {
        return this.service.authenticateCustomer(email, password)
    }
}
