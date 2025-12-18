import type { CreateCustomerDto, CustomerCredentialsDto } from 'apps/cores'
import type { TestContext } from 'testlib'

export function buildCreateCustomerDto(overrides = {}) {
    const createDto = {
        name: 'name',
        email: 'name@mail.com',
        birthDate: new Date(0),
        password: 'password',
        ...overrides
    }

    return createDto as CreateCustomerDto
}

export async function createCustomer(ctx: TestContext, override = {}) {
    const { CustomersClient } = await import('apps/cores')
    const customersService = ctx.module.get(CustomersClient)

    const createDto = buildCreateCustomerDto(override)

    const customer = await customersService.create(createDto)
    return customer
}

export async function loginCustomer(ctx: TestContext, credentials: CustomerCredentialsDto) {
    const { CustomersClient } = await import('apps/cores')
    const customersService = ctx.module.get(CustomersClient)

    const customer = await customersService.findCustomerByCredentials(credentials)

    const { accessToken, refreshToken } = await customersService.generateAuthTokens({
        customerId: customer ? customer.id : '',
        email: credentials.email
    })

    return { customer, accessToken, refreshToken }
}

export async function createAndLoginCustomer(ctx: TestContext) {
    const credentials = { email: 'user@mail.com', password: 'password' }

    const customer = await createCustomer(ctx, credentials)

    const { accessToken, refreshToken } = await loginCustomer(ctx, credentials)

    return { customer, accessToken, refreshToken }
}
