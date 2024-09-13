import { Injectable } from '@nestjs/common'
import {
    JwtAuthService,
    maps,
    MethodLog,
    PaginationOption,
    PaginationResult,
    Password
} from 'common'
import { CustomersRepository } from './customers.repository'
import { CreateCustomerDto, CustomerDto, QueryCustomersDto, UpdateCustomerDto } from './dto'

@Injectable()
export class CustomersService {
    constructor(
        private repository: CustomersRepository,
        private jwtAuthService: JwtAuthService
    ) {}

    @MethodLog()
    async createCustomer(createDto: CreateCustomerDto) {
        const customer = await this.repository.createCustomer({
            ...createDto,
            password: await Password.hash(createDto.password)
        })

        return new CustomerDto(customer)
    }

    @MethodLog()
    async updateCustomer(customerId: string, updateDto: UpdateCustomerDto) {
        const customer = await this.repository.updateCustomer(customerId, updateDto)
        return new CustomerDto(customer)
    }

    @MethodLog({ level: 'verbose' })
    async getCustomer(customerId: string) {
        const customer = await this.repository.getCustomer(customerId)
        return new CustomerDto(customer)
    }

    @MethodLog()
    async deleteCustomer(customerId: string) {
        await this.repository.deleteCustomer(customerId)
        return true
    }

    @MethodLog({ level: 'verbose' })
    async findCustomers(queryDto: QueryCustomersDto, pagination: PaginationOption) {
        const { items, ...paginated } = await this.repository.findCustomers(queryDto, pagination)

        return { ...paginated, items: maps(items, CustomerDto) } as PaginationResult<CustomerDto>
    }

    @MethodLog()
    async customersExist(customerIds: string[]) {
        return this.repository.existsByIds(customerIds)
    }

    @MethodLog()
    async login(customerId: string, email: string) {
        return this.jwtAuthService.generateAuthTokens(customerId, email)
    }

    @MethodLog()
    async refreshAuthTokens(refreshToken: string) {
        return this.jwtAuthService.refreshAuthTokens(refreshToken)
    }

    @MethodLog({ level: 'verbose' })
    async getCustomerByCredentials(email: string, password: string) {
        const customer = await this.repository.findByEmail(email)

        if (customer && (await Password.validate(password, customer.password)))
            return new CustomerDto(customer)

        return null
    }
}
