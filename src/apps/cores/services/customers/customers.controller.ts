import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Subjects } from 'shared/config'
import { CustomersService } from './customers.service'
import { CustomerCreateDto, CustomerQueryDto, CustomerUpdateDto } from './dtos'

@Controller()
export class CustomersController {
    constructor(private service: CustomersService) {}

    @MessagePattern(Subjects.Customers.createCustomer)
    async createCustomer(@Payload() createDto: CustomerCreateDto) {
        return this.service.createCustomer(createDto)
    }

    @MessagePattern(Subjects.Customers.updateCustomer)
    updateCustomer(
        @Payload('customerId') customerId: string,
        @Payload('updateDto') updateDto: CustomerUpdateDto
    ) {
        return this.service.updateCustomer(customerId, updateDto)
    }

    @MessagePattern(Subjects.Customers.getCustomer)
    getCustomer(@Payload() customerId: string) {
        return this.service.getCustomer(customerId)
    }

    @MessagePattern(Subjects.Customers.deleteCustomer)
    deleteCustomer(@Payload() customerId: string) {
        return this.service.deleteCustomer(customerId)
    }

    @MessagePattern(Subjects.Customers.findCustomers)
    findCustomers(@Payload() queryDto: CustomerQueryDto) {
        return this.service.findCustomers(queryDto)
    }

    @MessagePattern(Subjects.Customers.login)
    login(@Payload('userId') userId: string, @Payload('email') email: string) {
        return this.service.login(userId, email)
    }

    @MessagePattern(Subjects.Customers.refreshAuthTokens)
    refreshAuthTokens(@Payload() refreshToken: string) {
        return this.service.refreshAuthTokens(refreshToken)
    }

    @MessagePattern(Subjects.Customers.authenticateCustomer)
    authenticateCustomer(@Payload('email') email: string, @Payload('password') password: string) {
        return this.service.authenticateCustomer(email, password)
    }
}
