import { ConflictException, Injectable } from '@nestjs/common'
import { mapDocToDto } from 'common'
import { CustomersRepository } from './customers.repository'
import {
    CreateCustomerDto,
    CustomerAuthPayload,
    CustomerCredentialsDto,
    CustomerDto,
    SearchCustomersPageDto,
    UpdateCustomerDto
} from './dtos'
import { CustomerErrors } from './errors'
import { Customer } from './models'
import { CustomerAuthenticationService } from './services'

/**
 * The `findCustomerByCredentials` and `refreshAuthTokens` methods simply re-invoke methods from `CustomerAuthenticationService`,
 * which may seem like an anti-pattern.
 * However, the more important principle is that all externally exposed functionalities should go through `CustomersService`.
 * Therefore, `CustomersController` should only reference `CustomersService` and must not directly call `CustomerAuthenticationService`.
 *
 * findCustomerByCredentials, refreshAuthTokens는 단순히 CustomerAuthenticationService의 메소드를 재호출 하고 있어서 안티 패턴으로 보인다.
 * 그러나 더 중요한 원칙은 외부에 노출되는 모든 기능은 CustomersService을 통해서 이뤄져야 한다는 것이다.
 * 따라서 CustomersController는 CustomersService만 참조해야 하고 CustomerAuthenticationService를 직접 호출하면 안 된다.
 */
@Injectable()
export class CustomersService {
    constructor(
        private readonly repository: CustomersRepository,
        private readonly authenticationService: CustomerAuthenticationService
    ) {}

    async create(createDto: CreateCustomerDto) {
        const emailExists = await this.repository.existsByEmail(createDto.email)

        if (emailExists) {
            throw new ConflictException({
                ...CustomerErrors.EmailAlreadyExists,
                email: createDto.email
            })
        }

        const password = await this.authenticationService.hash(createDto.password)
        const newCustomer = await this.repository.create({ ...createDto, password })

        return this.toDto(newCustomer)
    }

    async update(customerId: string, updateDto: UpdateCustomerDto) {
        const customer = await this.repository.update(customerId, updateDto)

        return this.toDto(customer)
    }

    async getMany(customerIds: string[]) {
        const customers = await this.repository.getByIds(customerIds)

        return this.toDtos(customers)
    }

    async deleteMany(customerIds: string[]): Promise<void> {
        await this.repository.deleteByIds(customerIds)
    }

    async searchPage(searchDto: SearchCustomersPageDto) {
        const { items, ...pagination } = await this.repository.searchPage(searchDto)

        return { ...pagination, items: this.toDtos(items) }
    }

    async generateAuthTokens(payload: CustomerAuthPayload) {
        return this.authenticationService.generateAuthTokens(payload)
    }

    async refreshAuthTokens(refreshToken: string) {
        return this.authenticationService.refreshAuthTokens(refreshToken)
    }

    async findCustomerByCredentials(credentials: CustomerCredentialsDto) {
        const customer = await this.authenticationService.findCustomerByCredentials(credentials)

        return customer ? this.toDto(customer) : null
    }

    private toDto(customer: Customer) {
        return this.toDtos([customer])[0]
    }

    private toDtos(customers: Customer[]) {
        return customers.map((customer) =>
            mapDocToDto(customer, CustomerDto, ['id', 'name', 'email', 'birthDate'])
        )
    }
}
