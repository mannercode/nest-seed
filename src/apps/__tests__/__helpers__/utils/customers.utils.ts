import type { CreateCustomerDto, CustomerCredentialsDto } from 'apps/cores'
import type { TestContext } from 'testlib'

export function buildCreateCustomerDto(overrides = {}) {
    const createDto = {
        birthDate: new Date(0),
        email: 'name@mail.com',
        name: 'name',
        password: 'password',
        ...overrides
    }

    return createDto as CreateCustomerDto
}

export async function createAndLoginCustomer(ctx: TestContext) {
    const credentials = { email: 'user@mail.com', password: 'password' }

    const customer = await createCustomer(ctx, credentials)

    const { accessToken, refreshToken } = await loginCustomer(ctx, credentials)

    return { accessToken, customer, refreshToken }
}

export async function createCustomer(ctx: TestContext, override = {}) {
    const { CustomersService } = await import('apps/cores')
    const customersService = ctx.module.get(CustomersService)

    const createDto = buildCreateCustomerDto(override)

    const customer = await customersService.create(createDto)
    return customer
}

export async function loginCustomer(ctx: TestContext, credentials: CustomerCredentialsDto) {
    const { CustomersService } = await import('apps/cores')
    const customersService = ctx.module.get(CustomersService)

    const customer = await customersService.findCustomerByCredentials(credentials)

    const { accessToken, refreshToken } = await customersService.generateAuthTokens({
        customerId: customer ? customer.id : '',
        email: credentials.email
    })

    return { accessToken, customer, refreshToken }
}
