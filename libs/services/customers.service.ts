import { Injectable } from '@nestjs/common'
import { JwtAuthTokens, MethodLog } from 'common'
import {
    CustomerCreateDto,
    CustomerDto,
    CustomerUpdateDto,
    CustomerQueryDto,
    nullCustomer
} from 'types'

@Injectable()
export class CustomersService {
    constructor() {}

    @MethodLog()
    async createCustomer(createDto: CustomerCreateDto): Promise<CustomerDto> {
        return nullCustomer
    }

    @MethodLog()
    async updateCustomer(customerId: string, updateDto: CustomerUpdateDto): Promise<CustomerDto> {
        return nullCustomer
    }

    @MethodLog({ level: 'verbose' })
    async getCustomer(customerId: string): Promise<CustomerDto> {
        return nullCustomer
    }

    @MethodLog()
    async deleteCustomer(customerId: string): Promise<boolean> {
        return true
    }

    @MethodLog({ level: 'verbose' })
    async findCustomers(queryDto: CustomerQueryDto): Promise<CustomerDto[]> {
        return []
    }

    @MethodLog()
    async login(userId: string, email: string): Promise<JwtAuthTokens> {
        return { accessToken: '', refreshToken: '' }
    }

    @MethodLog()
    async refreshAuthTokens(refreshToken: string): Promise<JwtAuthTokens> {
        return { accessToken: '', refreshToken: '' }
    }

    @MethodLog({ level: 'verbose' })
    async authenticateCustomer(email: string, password: string): Promise<string | null> {
        return null
    }
}
