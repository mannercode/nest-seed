import { ConflictException, Injectable } from '@nestjs/common'
import { InjectJwtAuth, JwtAuthService, mapDocToDto, MethodLog, Password } from 'common'
import { CustomersRepository } from './customers.repository'
import { CustomerCreateDto, CustomerDto, CustomerQueryDto, CustomerUpdateDto } from './dtos'
import { CustomerDocument } from './models'

@Injectable()
export class CustomersService {
    constructor(
        private repository: CustomersRepository,
        @InjectJwtAuth('customer') private jwtAuthService: JwtAuthService
    ) {}
    @MethodLog()
    async createCustomer(createDto: CustomerCreateDto) {
        if (await this.repository.findByEmail(createDto.email)) {
            throw new ConflictException({
                code: 'ERR_CUSTOMER_EMAIL_ALREADY_EXISTS',
                message: 'Customer with email already exists',
                email: createDto.email
            })
        }
        const customer = await this.repository.createCustomer({
            ...createDto,
            password: await Password.hash(createDto.password)
        })

        return this.toDto(customer)
    }

    @MethodLog()
    async updateCustomer(customerId: string, updateDto: CustomerUpdateDto) {
        const customer = await this.repository.updateCustomer(customerId, updateDto)
        return this.toDto(customer)
    }

    @MethodLog({ level: 'verbose' })
    async getCustomer(customerId: string) {
        const customer = await this.repository.getById(customerId)
        return this.toDto(customer)
    }

    @MethodLog()
    async deleteCustomer(customerId: string) {
        await this.repository.deleteById(customerId)
        return true
    }

    @MethodLog({ level: 'verbose' })
    async findCustomers(queryDto: CustomerQueryDto) {
        const { items, ...paginated } = await this.repository.findCustomers(queryDto)

        return { ...paginated, items: this.toDtos(items) }
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
