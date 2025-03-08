import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy, JwtAuthTokens } from 'common'
import { ClientProxyConfig, Messages } from 'shared/config'
import { CustomerCreateDto, CustomerDto, CustomerQueryDto, CustomerUpdateDto } from './dtos'

@Injectable()
export class CustomersProxy {
    constructor(
        @InjectClientProxy(ClientProxyConfig.connName) private service: ClientProxyService
    ) {}

    async createCustomer(createDto: CustomerCreateDto): Promise<CustomerDto> {
        return this.service.getJson<CustomerDto>(Messages.Customers.createCustomer, createDto)
    }

    updateCustomer(customerId: string, updateDto: CustomerUpdateDto): Promise<CustomerDto> {
        return this.service.getJson(Messages.Customers.updateCustomer, { customerId, updateDto })
    }

    getCustomer(customerId: string): Promise<CustomerDto> {
        return this.service.getJson(Messages.Customers.getCustomer, customerId)
    }

    deleteCustomer(customerId: string): Promise<boolean> {
        return this.service.getJson(Messages.Customers.deleteCustomer, customerId)
    }

    findCustomers(queryDto: CustomerQueryDto): Promise<CustomerDto[]> {
        return this.service.getJson(Messages.Customers.findCustomers, queryDto)
    }

    login(userId: string, email: string): Promise<JwtAuthTokens> {
        return this.service.getJson(Messages.Customers.login, { userId, email })
    }

    refreshAuthTokens(refreshToken: string): Promise<JwtAuthTokens> {
        return this.service.getJson(Messages.Customers.refreshAuthTokens, refreshToken)
    }

    authenticateCustomer(email: string, password: string): Promise<string | null> {
        return this.service.getJson(Messages.Customers.authenticateCustomer, { email, password })
    }
}
