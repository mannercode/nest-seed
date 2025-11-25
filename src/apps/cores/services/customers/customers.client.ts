import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy, JwtAuthTokens, PaginationResult } from 'common'
import { Messages } from 'shared'
import {
    CreateCustomerDto,
    CustomerAuthPayload,
    CustomerCredentials,
    CustomerDto,
    DeleteCustomersResponse,
    SearchCustomersPageDto,
    UpdateCustomerDto
} from './dtos'

@Injectable()
export class CustomersClient {
    constructor(@InjectClientProxy() private proxy: ClientProxyService) {}

    async create(createDto: CreateCustomerDto): Promise<CustomerDto> {
        return this.proxy.getJson<CustomerDto>(Messages.Customers.create, createDto)
    }

    update(customerId: string, updateDto: UpdateCustomerDto): Promise<CustomerDto> {
        return this.proxy.getJson(Messages.Customers.update, { customerId, updateDto })
    }

    getMany(customerIds: string[]): Promise<CustomerDto[]> {
        return this.proxy.getJson(Messages.Customers.getMany, customerIds)
    }

    deleteMany(customerIds: string[]): Promise<DeleteCustomersResponse> {
        return this.proxy.getJson(Messages.Customers.deleteMany, customerIds)
    }

    searchPage(searchDto: SearchCustomersPageDto): Promise<PaginationResult<CustomerDto>> {
        return this.proxy.getJson(Messages.Customers.searchPage, searchDto)
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
