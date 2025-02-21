import { Injectable } from '@nestjs/common'
import {
    ClientProxyService,
    getProxyValue,
    InjectClientProxy,
    JwtAuthTokens,
    MethodLog
} from 'common'
import { ClientProxyConfig, Subjects } from 'shared/config'
import { CustomerCreateDto, CustomerDto, CustomerQueryDto, CustomerUpdateDto } from './dtos'

@Injectable()
export class CustomersProxy {
    constructor(
        @InjectClientProxy(ClientProxyConfig.connName) private service: ClientProxyService
    ) {}

    @MethodLog({ level: 'verbose' })
    async createCustomer(createDto: CustomerCreateDto): Promise<CustomerDto> {
        return getProxyValue(
            this.service.send<CustomerDto>(Subjects.Customers.createCustomer, createDto)
        )
    }

    @MethodLog({ level: 'verbose' })
    updateCustomer(customerId: string, updateDto: CustomerUpdateDto): Promise<CustomerDto> {
        return getProxyValue(
            this.service.send(Subjects.Customers.updateCustomer, { customerId, updateDto })
        )
    }

    @MethodLog({ level: 'verbose' })
    getCustomer(customerId: string): Promise<CustomerDto> {
        return getProxyValue(this.service.send(Subjects.Customers.getCustomer, customerId))
    }

    @MethodLog({ level: 'verbose' })
    deleteCustomer(customerId: string): Promise<boolean> {
        return getProxyValue(this.service.send(Subjects.Customers.deleteCustomer, customerId))
    }

    @MethodLog({ level: 'verbose' })
    findCustomers(queryDto: CustomerQueryDto): Promise<CustomerDto[]> {
        return getProxyValue(this.service.send(Subjects.Customers.findCustomers, queryDto))
    }

    @MethodLog({ level: 'verbose' })
    login(userId: string, email: string): Promise<JwtAuthTokens> {
        return getProxyValue(this.service.send(Subjects.Customers.login, { userId, email }))
    }

    @MethodLog({ level: 'verbose' })
    refreshAuthTokens(refreshToken: string): Promise<JwtAuthTokens> {
        return getProxyValue(this.service.send(Subjects.Customers.refreshAuthTokens, refreshToken))
    }

    @MethodLog({ level: 'verbose' })
    authenticateCustomer(email: string, password: string): Promise<string | null> {
        return getProxyValue(
            this.service.send(Subjects.Customers.authenticateCustomer, { email, password })
        )
    }
}
