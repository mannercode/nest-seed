import { Injectable } from '@nestjs/common'
import {
    ClientProxyService,
    getProxyValue,
    InjectClientProxy,
    JwtAuthTokens,
    MethodLog
} from 'common'
import { CustomerCreateDto, CustomerDto, CustomerQueryDto, CustomerUpdateDto } from 'cores'

@Injectable()
export class CustomersService {
    constructor(@InjectClientProxy('SERVICES_CLIENT') private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    createCustomer(createDto: CustomerCreateDto): Promise<CustomerDto> {
        return getProxyValue(this.service.send('createCustomer', createDto))
    }

    @MethodLog({ level: 'verbose' })
    updateCustomer(customerId: string, updateDto: CustomerUpdateDto): Promise<CustomerDto> {
        return getProxyValue(this.service.send('updateCustomer', { customerId, updateDto }))
    }

    @MethodLog({ level: 'verbose' })
    getCustomer(customerId: string): Promise<CustomerDto> {
        return getProxyValue(this.service.send('getCustomer', customerId))
    }

    @MethodLog({ level: 'verbose' })
    deleteCustomer(customerId: string): Promise<boolean> {
        return getProxyValue(this.service.send('deleteCustomer', customerId))
    }

    @MethodLog({ level: 'verbose' })
    findCustomers(queryDto: CustomerQueryDto): Promise<CustomerDto[]> {
        return getProxyValue(this.service.send('findCustomers', queryDto))
    }

    @MethodLog({ level: 'verbose' })
    login(userId: string, email: string): Promise<JwtAuthTokens> {
        return getProxyValue(this.service.send('login', { userId, email }))
    }

    @MethodLog({ level: 'verbose' })
    refreshAuthTokens(refreshToken: string): Promise<JwtAuthTokens> {
        return getProxyValue(this.service.send('refreshAuthTokens', refreshToken))
    }

    @MethodLog({ level: 'verbose' })
    authenticateCustomer(email: string, password: string): Promise<string | null> {
        return getProxyValue(this.service.send('authenticateCustomer', { email, password }))
    }
}
