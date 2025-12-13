import { CreateCustomerDto } from 'apps/cores'
import { TestContext } from 'testlib'

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

export async function createCustomerAndLogin(ctx: TestContext) {
    const email = 'user@mail.com'
    const password = 'password'
    const customer = await createCustomer(ctx, { email, password })

    const { CustomersClient } = await import('apps/cores')
    const customersService = ctx.module.get(CustomersClient)

    const { accessToken, refreshToken } = await customersService.generateAuthTokens({
        customerId: customer.id,
        email: customer.email
    })

    return { customer, accessToken, refreshToken }
}
