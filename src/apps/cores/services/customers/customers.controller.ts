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

    @MessagePattern(Messages.Customers.create)
    async create(@Payload() createDto: CreateCustomerDto) {
        return this.service.create(createDto)
    }

    @MessagePattern(Messages.Customers.update)
    update(
        @Payload('customerId') customerId: string,
        @Payload('updateDto') updateDto: UpdateCustomerDto
    ) {
        return this.service.update(customerId, updateDto)
    }

    @MessagePattern(Messages.Customers.getMany)
    getMany(@Payload() customerIds: string[]) {
        return this.service.getMany(customerIds)
    }

    @MessagePattern(Messages.Customers.deleteMany)
    deleteMany(@Payload() customerIds: string[]) {
        return this.service.deleteMany(customerIds)
    }

    @MessagePattern(Messages.Customers.searchPage)
    searchPage(@Payload() searchDto: SearchCustomersPageDto) {
        return this.service.searchPage(searchDto)
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
