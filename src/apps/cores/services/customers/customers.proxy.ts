import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy, JwtAuthTokens, MethodLog } from 'common'
import { ClientProxyConfig, Messages } from 'shared/config'
import { CustomerCreateDto, CustomerDto, CustomerQueryDto, CustomerUpdateDto } from './dtos'

@Injectable()
export class CustomersProxy {
    constructor(
        @InjectClientProxy(ClientProxyConfig.connName) private service: ClientProxyService
    ) {}

    @MethodLog({ level: 'verbose' })
    async createCustomer(createDto: CustomerCreateDto): Promise<CustomerDto> {
        return this.service.getJson<CustomerDto>(Messages.Customers.createCustomer, createDto)
    }

    @MethodLog({ level: 'verbose' })
    updateCustomer(customerId: string, updateDto: CustomerUpdateDto): Promise<CustomerDto> {
        return this.service.getJson(Messages.Customers.updateCustomer, { customerId, updateDto })
    }

    @MethodLog({ level: 'verbose' })
    getCustomer(customerId: string): Promise<CustomerDto> {
        return this.service.getJson(Messages.Customers.getCustomer, customerId)
    }

    @MethodLog({ level: 'verbose' })
    deleteCustomer(customerId: string): Promise<boolean> {
        return this.service.getJson(Messages.Customers.deleteCustomer, customerId)
    }

    @MethodLog({ level: 'verbose' })
    findCustomers(queryDto: CustomerQueryDto): Promise<CustomerDto[]> {
        return this.service.getJson(Messages.Customers.findCustomers, queryDto)
    }

    @MethodLog({ level: 'verbose' })
    login(userId: string, email: string): Promise<JwtAuthTokens> {
        return this.service.getJson(Messages.Customers.login, { userId, email })
    }

    @MethodLog({ level: 'verbose' })
    refreshAuthTokens(refreshToken: string): Promise<JwtAuthTokens> {
        return this.service.getJson(Messages.Customers.refreshAuthTokens, refreshToken)
    }

    @MethodLog({ level: 'verbose' })
    authenticateCustomer(email: string, password: string): Promise<string | null> {
        return this.service.getJson(Messages.Customers.authenticateCustomer, { email, password })
    }
}
