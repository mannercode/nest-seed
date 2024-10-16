import { Injectable } from '@nestjs/common'
import { JwtAuthService, maps, MethodLog, objectId, ObjectId, objectIds, PaginationResult, Password } from 'common'
import { CustomersRepository } from './customers.repository'
import { CustomerCreationDto, CustomerDto, CustomerQueryDto, CustomerUpdateDto } from './dto'

@Injectable()
export class CustomersService {
    constructor(
        private repository: CustomersRepository,
        private jwtAuthService: JwtAuthService
    ) {}

    @MethodLog()
    async createCustomer(creationDto: CustomerCreationDto) {
        const customer = await this.repository.createCustomer({
            ...creationDto,
            password: await Password.hash(creationDto.password)
        })

        return new CustomerDto(customer)
    }

    @MethodLog()
    async updateCustomer(customerId: string, updateDto: CustomerUpdateDto) {
        const customer = await this.repository.updateCustomer(objectId(customerId), updateDto)
        return new CustomerDto(customer)
    }

    @MethodLog({ level: 'verbose' })
    async getCustomer(customerId: string) {
        const customer = await this.repository.getCustomer(objectId(customerId))
        return new CustomerDto(customer)
    }

    @MethodLog()
    async deleteCustomer(customerId: string) {
        await this.repository.deleteCustomer(objectId(customerId))
        return true
    }

    @MethodLog({ level: 'verbose' })
    async findCustomers(queryDto: CustomerQueryDto) {
        const { items, ...paginated } = await this.repository.findCustomers(queryDto)

        return { ...paginated, items: maps(items, CustomerDto) } as PaginationResult<CustomerDto>
    }

    @MethodLog()
    async customersExist(customerIds: string[]) {
        return this.repository.existsByIds(objectIds(customerIds))
    }

    @MethodLog()
    async login(userId: string, email: string) {
        return this.jwtAuthService.generateAuthTokens(userId, email)
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
