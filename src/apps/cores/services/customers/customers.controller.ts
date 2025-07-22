import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Messages } from 'shared'
import { CustomersService } from './customers.service'
import {
    CustomerAuthPayload,
    CreateCustomerDto,
    SearchCustomersPageDto,
    UpdateCustomerDto,
    CustomerCredentials
} from './dtos'

@Controller()
export class CustomersController {
    constructor(private service: CustomersService) {}

    @MessagePattern(Messages.Customers.createCustomer)
    async createCustomer(@Payload() createDto: CreateCustomerDto) {
        return this.service.createCustomer(createDto)
    }

    @MessagePattern(Messages.Customers.updateCustomer)
    updateCustomer(
        @Payload('customerId') customerId: string,
        @Payload('updateDto') updateDto: UpdateCustomerDto
    ) {
        return this.service.updateCustomer(customerId, updateDto)
    }

    @MessagePattern(Messages.Customers.getCustomers)
    getCustomers(@Payload() customerIds: string[]) {
        return this.service.getCustomers(customerIds)
    }

    @MessagePattern(Messages.Customers.deleteCustomers)
    deleteCustomers(@Payload() customerIds: string[]) {
        return this.service.deleteCustomers(customerIds)
    }

    @MessagePattern(Messages.Customers.searchCustomersPage)
    searchCustomersPage(@Payload() searchDto: SearchCustomersPageDto) {
        return this.service.searchCustomersPage(searchDto)
    }

    @MessagePattern(Messages.Customers.generateAuthTokens)
    generateAuthTokens(@Payload() payload: CustomerAuthPayload) {
        return this.service.generateAuthTokens(payload)
    }

    @MessagePattern(Messages.Customers.refreshAuthTokens)
    refreshAuthTokens(@Payload() refreshToken: string) {
        return this.service.refreshAuthTokens(refreshToken)
    }

    @MessagePattern(Messages.Customers.findCustomerByCredentials)
    findCustomerByCredentials(@Payload() credentials: CustomerCredentials) {
        return this.service.findCustomerByCredentials(credentials)
    }
}
