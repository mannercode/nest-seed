import { ConflictException, Injectable } from '@nestjs/common'
import { JwtAuthService, MethodLog, Password, toDto, toDtos } from 'common'
import { CustomersRepository } from './customers.repository'
import { CustomerCreateDto, CustomerDto, CustomerQueryDto, CustomerUpdateDto } from './dtos'

@Injectable()
export class CustomersService {
    constructor(
        private repository: CustomersRepository,
        private jwtAuthService: JwtAuthService
    ) {}

    @MethodLog()
    async createCustomer(createDto: CustomerCreateDto) {
        if (await this.repository.findByEmail(createDto.email))
            throw new ConflictException(`Customer with email ${createDto.email} already exists`)

        const customer = await this.repository.createCustomer({
            ...createDto,
            password: await Password.hash(createDto.password)
        })

        return toDto(customer, CustomerDto)
    }

    @MethodLog()
    async updateCustomer(customerId: string, updateDto: CustomerUpdateDto) {
        const customer = await this.repository.updateCustomer(customerId, updateDto)
        return toDto(customer, CustomerDto)
    }

    @MethodLog({ level: 'verbose' })
    async getCustomer(customerId: string) {
        const customer = await this.repository.getById(customerId)
        return toDto(customer, CustomerDto)
    }

    @MethodLog()
    async deleteCustomer(customerId: string) {
        await this.repository.deleteById(customerId)
        return true
    }

    @MethodLog({ level: 'verbose' })
    async findCustomers(queryDto: CustomerQueryDto) {
        const { items, ...paginated } = await this.repository.findCustomers(queryDto)

        return { ...paginated, items: toDtos(items, CustomerDto) }
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
            return toDto(customer, CustomerDto)

        return null
    }
}
