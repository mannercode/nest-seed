import { Injectable } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { CustomerCreateDto, CustomerQueryDto, CustomerUpdateDto } from 'types'
import { CustomersService } from './customers.service'

@Injectable()
export class CustomersController {
    constructor(private service: CustomersService) {}

    @MessagePattern({ cmd: 'createCustomer' })
    async createCustomer(@Payload() createDto: CustomerCreateDto) {
        return this.service.createCustomer(createDto)
    }

    @MessagePattern({ cmd: 'updateCustomer' })
    async updateCustomer(
        @Payload('customerId') customerId: string,
        @Payload('updateDto') updateDto: CustomerUpdateDto
    ) {
        return this.service.updateCustomer(customerId, updateDto)
    }

    @MessagePattern({ cmd: 'getCustomer' })
    async getCustomer(@Payload() customerId: string) {
        return this.service.getCustomer(customerId)
    }

    @MessagePattern({ cmd: 'deleteCustomer' })
    async deleteCustomer(@Payload() customerId: string) {
        return this.service.deleteCustomer(customerId)
    }

    @MessagePattern({ cmd: 'findCustomers' })
    async findCustomers(@Payload() queryDto: CustomerQueryDto) {
        return this.service.findCustomers(queryDto)
    }

    @MessagePattern({ cmd: 'login' })
    async login(@Payload('userId') userId: string, @Payload('email') email: string) {
        return this.service.login(userId, email)
    }

    @MessagePattern({ cmd: 'refreshAuthTokens' })
    async refreshAuthTokens(@Payload() refreshToken: string) {
        return this.service.refreshAuthTokens(refreshToken)
    }

    @MessagePattern({ cmd: 'authenticateCustomer' })
    async authenticateCustomer(
        @Payload('email') email: string,
        @Payload('password') password: string
    ) {
        return this.service.authenticateCustomer(email, password)
    }
}
