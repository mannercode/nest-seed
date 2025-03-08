import { ConflictException, Injectable } from '@nestjs/common'
import { InjectJwtAuth, JwtAuthService, mapDocToDto, Password } from 'common'
import { CoreErrors } from 'cores/core-errors'
import { CustomersRepository } from './customers.repository'
import { CustomerCreateDto, CustomerDto, CustomerQueryDto, CustomerUpdateDto } from './dtos'
import { CustomerDocument } from './models'

@Injectable()
export class CustomersService {
    constructor(
        private repository: CustomersRepository,
        @InjectJwtAuth('customer') private jwtAuthService: JwtAuthService
    ) {}

    async createCustomer(createDto: CustomerCreateDto) {
        const foundEmail = await this.repository.findByEmail(createDto.email)

        if (foundEmail) {
            throw new ConflictException({
                ...CoreErrors.Customer.emailAlreadyExists,
                email: createDto.email
            })
        }

        const customer = await this.repository.createCustomer({
            ...createDto,
            password: await Password.hash(createDto.password)
        })

        return this.toDto(customer)
    }

    async updateCustomer(customerId: string, updateDto: CustomerUpdateDto) {
        const customer = await this.repository.updateCustomer(customerId, updateDto)
        return this.toDto(customer)
    }

    async getCustomer(customerId: string) {
        const customer = await this.repository.getById(customerId)
        return this.toDto(customer)
    }

    async deleteCustomer(customerId: string) {
        await this.repository.deleteById(customerId)
        return true
    }

    async findCustomers(queryDto: CustomerQueryDto) {
        const { items, ...paginated } = await this.repository.findCustomers(queryDto)
        return { ...paginated, items: this.toDtos(items) }
    }

    async login(userId: string, email: string) {
        return this.jwtAuthService.generateAuthTokens(userId, email)
    }

    async refreshAuthTokens(refreshToken: string) {
        return this.jwtAuthService.refreshAuthTokens(refreshToken)
    }

    async authenticateCustomer(email: string, password: string) {
        const customer = await this.repository.findByEmail(email)

        if (!customer) return null

        const gotPassword = await this.repository.getPassword(customer.id)

        if (await Password.validate(password, gotPassword)) {
            return customer.id
        }

        return null
    }

    private toDto = (customer: CustomerDocument) =>
        mapDocToDto(customer, CustomerDto, ['id', 'name', 'email', 'birthdate'])

    private toDtos = (customers: CustomerDocument[]) =>
        customers.map((customer) => this.toDto(customer))
}
