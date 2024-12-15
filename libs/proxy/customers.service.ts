import { Injectable } from '@nestjs/common'
import { ClientProxyService, JwtAuthTokens, MethodLog } from 'common'
import { Observable } from 'rxjs'
import { CustomerCreateDto, CustomerDto, CustomerQueryDto, CustomerUpdateDto } from 'types'

@Injectable()
export class CustomersService {
    constructor(private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    createCustomer(createDto: CustomerCreateDto): Observable<CustomerDto> {
        return this.service.send('createCustomer', createDto)
    }

    @MethodLog({ level: 'verbose' })
    updateCustomer(customerId: string, updateDto: CustomerUpdateDto): Observable<CustomerDto> {
        return this.service.send('updateCustomer', { customerId, updateDto })
    }

    @MethodLog({ level: 'verbose' })
    getCustomer(customerId: string): Observable<CustomerDto> {
        return this.service.send('getCustomer', customerId)
    }

    @MethodLog({ level: 'verbose' })
    deleteCustomer(customerId: string): Observable<boolean> {
        return this.service.send('deleteCustomer', customerId)
    }

    @MethodLog({ level: 'verbose' })
    findCustomers(queryDto: CustomerQueryDto): Observable<CustomerDto[]> {
        return this.service.send('findCustomers', queryDto)
    }

    @MethodLog({ level: 'verbose' })
    login(userId: string, email: string): Observable<JwtAuthTokens> {
        return this.service.send('login', { userId, email })
    }

    @MethodLog({ level: 'verbose' })
    refreshAuthTokens(refreshToken: string): Observable<JwtAuthTokens> {
        return this.service.send('refreshAuthTokens', refreshToken)
    }

    @MethodLog({ level: 'verbose' })
    authenticateCustomer(email: string, password: string): Observable<string | null> {
        return this.service.send('authenticateCustomer', { email, password })
    }
}
