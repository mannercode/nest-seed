import { Injectable } from '@nestjs/common'
import {
    ClientProxyService,
    DeleteResult,
    InjectClientProxy,
    JwtAuthTokens,
    PaginationResult
} from 'common'
import { Messages } from 'shared'
import {
    CreateCustomerDto,
    CustomerAuthPayload,
    CustomerCredentials,
    CustomerDto,
    SearchCustomersPageDto,
    UpdateCustomerDto
} from './dtos'

@Injectable()
export class CustomersClient {
    constructor(@InjectClientProxy() private proxy: ClientProxyService) {}

    async createCustomer(createDto: CreateCustomerDto): Promise<CustomerDto> {
        return this.proxy.getJson<CustomerDto>(Messages.Customers.createCustomer, createDto)
    }

    updateCustomer(customerId: string, updateDto: UpdateCustomerDto): Promise<CustomerDto> {
        return this.proxy.getJson(Messages.Customers.updateCustomer, { customerId, updateDto })
    }

    getCustomers(customerIds: string[]): Promise<CustomerDto[]> {
        return this.proxy.getJson(Messages.Customers.getCustomers, customerIds)
    }

    deleteCustomers(customerIds: string[]): Promise<DeleteResult> {
        return this.proxy.getJson(Messages.Customers.deleteCustomers, customerIds)
    }

    searchCustomersPage(searchDto: SearchCustomersPageDto): Promise<PaginationResult<CustomerDto>> {
        return this.proxy.getJson(Messages.Customers.searchCustomersPage, searchDto)
    }

    generateAuthTokens(payload: CustomerAuthPayload): Promise<JwtAuthTokens> {
        return this.proxy.getJson(Messages.Customers.generateAuthTokens, payload)
    }

    refreshAuthTokens(refreshToken: string): Promise<JwtAuthTokens> {
        return this.proxy.getJson(Messages.Customers.refreshAuthTokens, refreshToken)
    }

    findCustomerByCredentials(credentials: CustomerCredentials): Promise<CustomerDto | null> {
        return this.proxy.getJson(Messages.Customers.findCustomerByCredentials, credentials)
    }
}
