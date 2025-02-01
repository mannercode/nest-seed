import { Injectable } from '@nestjs/common'
import {
    ClientProxyService,
    getProxyValue,
    InjectClientProxy,
    jsonToObject,
    JwtAuthTokens,
    MethodLog
} from 'common'
import { CustomerCreateDto, CustomerDto, CustomerQueryDto, CustomerUpdateDto } from './dtos'
import { lastValueFrom } from 'rxjs'

@Injectable()
export class CustomersProxy {
    constructor(@InjectClientProxy('clientProxy') private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    async createCustomer(createDto: CustomerCreateDto): Promise<CustomerDto> {
        const observer = this.service.send<CustomerDto>('cores.customers.createCustomer', createDto)
        const value = await lastValueFrom(observer)
        const json = jsonToObject(value)
        return json
        // return getProxyValue(observer)
    }

    @MethodLog({ level: 'verbose' })
    updateCustomer(customerId: string, updateDto: CustomerUpdateDto): Promise<CustomerDto> {
        return getProxyValue(
            this.service.send('cores.customers.updateCustomer', { customerId, updateDto })
        )
    }

    @MethodLog({ level: 'verbose' })
    getCustomer(customerId: string): Promise<CustomerDto> {
        return getProxyValue(this.service.send('cores.customers.getCustomer', customerId))
    }

    @MethodLog({ level: 'verbose' })
    deleteCustomer(customerId: string): Promise<boolean> {
        return getProxyValue(this.service.send('cores.customers.deleteCustomer', customerId))
    }

    @MethodLog({ level: 'verbose' })
    findCustomers(queryDto: CustomerQueryDto): Promise<CustomerDto[]> {
        return getProxyValue(this.service.send('cores.customers.findCustomers', queryDto))
    }

    @MethodLog({ level: 'verbose' })
    login(userId: string, email: string): Promise<JwtAuthTokens> {
        return getProxyValue(this.service.send('cores.customers.login', { userId, email }))
    }

    @MethodLog({ level: 'verbose' })
    refreshAuthTokens(refreshToken: string): Promise<JwtAuthTokens> {
        return getProxyValue(this.service.send('cores.customers.refreshAuthTokens', refreshToken))
    }

    @MethodLog({ level: 'verbose' })
    authenticateCustomer(email: string, password: string): Promise<string | null> {
        return getProxyValue(
            this.service.send('cores.customers.authenticateCustomer', { email, password })
        )
    }
}
