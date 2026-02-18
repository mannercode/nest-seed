import { Injectable } from '@nestjs/common'
import { ClientProxyService, JwtAuthTokens, PaginationResult } from 'common'
import { InjectClientProxy } from 'common'
import { Messages } from 'shared'
import {
    CreateCustomerDto,
    CustomerAuthPayload,
    CustomerCredentialsDto,
    CustomerDto,
    SearchCustomersPageDto,
    UpdateCustomerDto
} from './dtos'

@Injectable()
export class CustomersClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    create(createDto: CreateCustomerDto): Promise<CustomerDto> {
        return this.proxy.request(Messages.Customers.create, createDto)
    }

    async deleteMany(customerIds: string[]): Promise<void> {
        await this.proxy.request(Messages.Customers.deleteMany, customerIds)
    }

    findCustomerByCredentials(credentials: CustomerCredentialsDto): Promise<CustomerDto | null> {
        return this.proxy.request(Messages.Customers.findCustomerByCredentials, credentials)
    }

    generateAuthTokens(payload: CustomerAuthPayload): Promise<JwtAuthTokens> {
        return this.proxy.request(Messages.Customers.generateAuthTokens, payload)
    }

    getMany(customerIds: string[]): Promise<CustomerDto[]> {
        return this.proxy.request(Messages.Customers.getMany, customerIds)
    }

    refreshAuthTokens(refreshToken: string): Promise<JwtAuthTokens> {
        return this.proxy.request(Messages.Customers.refreshAuthTokens, refreshToken)
    }

    searchPage(searchDto: SearchCustomersPageDto): Promise<PaginationResult<CustomerDto>> {
        return this.proxy.request(Messages.Customers.searchPage, searchDto)
    }

    update(customerId: string, updateDto: UpdateCustomerDto): Promise<CustomerDto> {
        return this.proxy.request(Messages.Customers.update, { customerId, updateDto })
    }
}
